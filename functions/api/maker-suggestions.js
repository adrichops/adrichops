function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maker suggestion</title></head><body style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 720px; margin: 40px auto; padding: 0 20px;">${body}</body></html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanBlock(value, maxLength) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function csvList(value) {
  return cleanText(value, 700)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json();
  }
  const data = await request.formData();
  return Object.fromEntries(data.entries());
}

function buildPayload(form) {
  const source = cleanText(form.source_label, 180) || cleanText(form.source_url, 600);
  return {
    requestType: cleanText(form.request_type, 80),
    confidence: cleanText(form.confidence, 40) || "medium",
    regionId: cleanText(form.region_id, 120),
    node: {
      id: cleanText(form.node_id, 160),
      name: cleanText(form.node_name, 180),
      role: cleanText(form.role, 80),
      aliases: csvList(form.aliases),
      specialty: cleanBlock(form.specialty, 800),
      famousLines: csvList(form.famous_lines),
    },
    edge: {
      from: cleanText(form.relationship_from, 160),
      to: cleanText(form.relationship_to, 160),
      kind: cleanText(form.relationship_kind, 80),
      label: cleanText(form.relationship_label, 180),
      detail: cleanBlock(form.relationship_detail, 900),
    },
    source: {
      idHint: source ? source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) : "",
      label: cleanText(form.source_label, 180),
      url: cleanText(form.source_url, 600),
    },
    notes: cleanBlock(form.notes, 1400),
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

async function sendEmail(env, message) {
  if (!env.RESEND_API_KEY || !message.to || !message.from) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    return { skipped: false, error: await response.text() };
  }
  return { skipped: false };
}

function approvalLinks(request, env, id) {
  const url = new URL(request.url);
  const token = encodeURIComponent(env.ADRICHOPS_APPROVAL_TOKEN || "");
  const base = `${url.origin}/api/maker-suggestions?id=${encodeURIComponent(id)}&token=${token}`;
  return {
    approve: `${base}&action=approve`,
    reject: `${base}&action=reject`,
    implemented: `${base}&action=implemented`,
  };
}

function payloadSummary(payload) {
  return [
    `Request type: ${payload.requestType || "n/a"}`,
    `Region id: ${payload.regionId || "n/a"}`,
    `Node: ${payload.node.name || payload.node.id || "n/a"} (${payload.node.role || "role pending"})`,
    `Edge: ${payload.edge.from || "n/a"} -> ${payload.edge.to || "n/a"} (${payload.edge.kind || "type pending"})`,
    `Source: ${payload.source.label || "n/a"} ${payload.source.url || ""}`.trim(),
    `Confidence: ${payload.confidence || "medium"}`,
    `Notes: ${payload.notes || "n/a"}`,
  ].join("\n");
}

async function getSuggestion(env, id) {
  return await env.ADRICHOPS_DB.prepare(
    `SELECT * FROM maker_change_suggestions WHERE id = ?`
  ).bind(id).first();
}

export async function onRequestPost({ request, env }) {
  if (!env.ADRICHOPS_DB) {
    return json({ error: "Maker suggestion storage is not configured yet." }, 503);
  }

  let form;
  try {
    form = await readForm(request);
  } catch (error) {
    return json({ error: "Could not read the suggestion form." }, 400);
  }

  if (cleanText(form.website, 120)) {
    return json({ ok: true, message: "Suggestion sent for review." });
  }

  const submitterEmail = normalizeEmail(form.submitter_email);
  if (!validEmail(submitterEmail)) {
    return json({ error: "Enter a valid email address so the submitter can be notified." }, 400);
  }

  const requestType = cleanText(form.request_type, 80);
  if (!requestType) {
    return json({ error: "Choose a change type." }, 400);
  }

  const payload = buildPayload(form);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const pageUrl = cleanText(form.page_url, 500) || new URL(request.url).origin;
  const pathname = cleanText(form.pathname, 240) || "/maker-map/";
  const userAgent = cleanText(request.headers.get("user-agent"), 300);
  const submitterName = cleanText(form.submitter_name, 120);

  await env.ADRICHOPS_DB.prepare(
    `INSERT INTO maker_change_suggestions
      (id, created_at, updated_at, status, request_type, region_id, node_id, node_name, role, aliases, specialty, famous_lines, relationship_from, relationship_to, relationship_kind, relationship_label, relationship_detail, source_label, source_url, confidence, submitter_name, submitter_email, notes, page_url, pathname, user_agent, payload_json)
     VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      now,
      now,
      requestType,
      payload.regionId,
      payload.node.id,
      payload.node.name,
      payload.node.role,
      payload.node.aliases.join(", "),
      payload.node.specialty,
      payload.node.famousLines.join(", "),
      payload.edge.from,
      payload.edge.to,
      payload.edge.kind,
      payload.edge.label,
      payload.edge.detail,
      payload.source.label,
      payload.source.url,
      payload.confidence,
      submitterName,
      submitterEmail,
      payload.notes,
      pageUrl,
      pathname,
      userAgent,
      JSON.stringify(payload)
    )
    .run();

  const adminEmail = normalizeEmail(env.ADRICHOPS_ADMIN_EMAIL);
  const fromEmail = cleanText(env.ADRICHOPS_FROM_EMAIL, 254) || adminEmail;
  const links = approvalLinks(request, env, id);
  const text = [
    "New maker-map change suggestion",
    "",
    `Submitter: ${submitterName || "Anonymous"} <${submitterEmail}>`,
    `Page: ${pageUrl}`,
    "",
    payloadSummary(payload),
    "",
    "Graph-shaped payload:",
    JSON.stringify(payload, null, 2),
    "",
    `Approve: ${links.approve}`,
    `Reject: ${links.reject}`,
    `Mark implemented: ${links.implemented}`,
  ].join("\n");
  const emailResult = await sendEmail(env, {
    from: fromEmail,
    to: adminEmail,
    subject: `Adrichops maker map suggestion: ${payload.node.name || payload.edge.label || requestType}`,
    text,
    html: `<h1>New maker-map change suggestion</h1><p><b>Submitter:</b> ${escapeHtml(submitterName || "Anonymous")} &lt;${escapeHtml(submitterEmail)}&gt;</p><p><b>Page:</b> ${escapeHtml(pageUrl)}</p><pre>${escapeHtml(payloadSummary(payload))}</pre><h2>Graph-shaped payload</h2><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre><p><a href="${escapeHtml(links.approve)}">Approve</a> · <a href="${escapeHtml(links.reject)}">Reject</a> · <a href="${escapeHtml(links.implemented)}">Mark implemented</a></p>`,
  });

  return json({
    ok: true,
    id,
    message: emailResult.skipped
      ? "Suggestion saved. Email notifications need to be configured."
      : "Suggestion sent for review.",
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.ADRICHOPS_DB) {
    return html("<h1>Storage is not configured.</h1>", 503);
  }

  const url = new URL(request.url);
  const action = cleanText(url.searchParams.get("action"), 40);
  const id = cleanText(url.searchParams.get("id"), 80);
  const token = url.searchParams.get("token") || "";
  if (!id || !action) {
    return json({ error: "Missing suggestion id or action." }, 400);
  }
  if (!env.ADRICHOPS_APPROVAL_TOKEN || token !== env.ADRICHOPS_APPROVAL_TOKEN) {
    return html("<h1>Approval link is not valid.</h1>", 403);
  }

  const suggestion = await getSuggestion(env, id);
  if (!suggestion) {
    return html("<h1>Suggestion not found.</h1>", 404);
  }

  const now = new Date().toISOString();
  const validActions = new Set(["approve", "reject", "implemented"]);
  if (!validActions.has(action)) {
    return html("<h1>Unknown action.</h1>", 400);
  }

  const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "implemented";
  await env.ADRICHOPS_DB.prepare(
    `UPDATE maker_change_suggestions
     SET status = ?, updated_at = ?, implemented_at = CASE WHEN ? = 'implemented' THEN ? ELSE implemented_at END
     WHERE id = ?`
  ).bind(nextStatus, now, nextStatus, now, id).run();

  const submitterEmail = normalizeEmail(suggestion.submitter_email);
  const fromEmail = cleanText(env.ADRICHOPS_FROM_EMAIL, 254) || normalizeEmail(env.ADRICHOPS_ADMIN_EMAIL);
  if (validEmail(submitterEmail)) {
    const subject = nextStatus === "implemented"
      ? "Your Adrichops maker-map suggestion was implemented"
      : nextStatus === "approved"
        ? "Your Adrichops maker-map suggestion was accepted"
        : "Your Adrichops maker-map suggestion was reviewed";
    const text = nextStatus === "implemented"
      ? "Thanks for the maker-map correction. I accepted it and marked it implemented on Adrichops."
      : nextStatus === "approved"
        ? "Thanks for the maker-map correction. I accepted it and queued it for implementation."
        : "Thanks for the maker-map correction. I reviewed it, but I am not adding it to the map right now.";
    await sendEmail(env, {
      from: fromEmail,
      to: submitterEmail,
      subject,
      text,
      html: `<p>${escapeHtml(text)}</p>`,
    });
  }

  return html(`<h1>Suggestion ${escapeHtml(nextStatus)}.</h1><p>ID: ${escapeHtml(id)}</p><p>You can close this tab.</p>`);
}
