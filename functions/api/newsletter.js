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

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    return json({ error: "Newsletter storage is not configured yet." }, 503);
  }

  let form;
  try {
    form = await readForm(request);
  } catch (error) {
    return json({ error: "Could not read the signup form." }, 400);
  }

  if (cleanText(form.website, 120)) {
    return json({ ok: true, message: "Signed up." });
  }

  const email = normalizeEmail(form.email);
  if (!validEmail(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  const now = new Date().toISOString();
  const pageUrl = cleanText(form.page_url, 500) || new URL(request.url).origin;
  const pathname = cleanText(form.pathname, 240) || "/";

  await env.ADRICHOPS_DB.prepare(
    `INSERT INTO newsletter_subscribers
      (id, email, status, source_url, pathname, created_at, updated_at)
     VALUES (?, ?, 'subscribed', ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
      status = 'subscribed',
      source_url = excluded.source_url,
      pathname = excluded.pathname,
      updated_at = excluded.updated_at`
  )
    .bind(crypto.randomUUID(), email, pageUrl, pathname, now, now)
    .run();

  return json({ ok: true, message: "Signed up." });
}

export function onRequestGet() {
  return json({ error: "Use POST to sign up." }, 405);
}
