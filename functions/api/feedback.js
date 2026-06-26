function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function readForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json();
  }
  const data = await request.formData();
  return Object.fromEntries(data.entries());
}

export async function onRequestPost({ request, env }) {
  if (!env.ADRICHOPS_DB) {
    return json({ error: "Feedback storage is not configured yet." }, 503);
  }

  let form;
  try {
    form = await readForm(request);
  } catch (error) {
    return json({ error: "Could not read the feedback form." }, 400);
  }

  if (cleanText(form.website, 120)) {
    return json({ ok: true, message: "Feedback sent." });
  }

  const score = Number.parseInt(form.score, 10);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return json({ error: "Choose a satisfaction score from 1 to 5." }, 400);
  }

  const now = new Date().toISOString();
  const pageUrl = cleanText(form.page_url, 500) || new URL(request.url).origin;
  const pathname = cleanText(form.pathname, 240) || "/";
  const comment = cleanText(form.comment, 1200);
  const userAgent = cleanText(request.headers.get("user-agent"), 300);

  await env.ADRICHOPS_DB.prepare(
    `INSERT INTO feedback_submissions
      (id, created_at, page_url, pathname, score, comment, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), now, pageUrl, pathname, score, comment, userAgent)
    .run();

  return json({ ok: true, message: "Feedback sent." });
}

export function onRequestGet() {
  return json({ error: "Use POST to send feedback." }, 405);
}
