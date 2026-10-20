export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Keep retired hunt links and cached clients from reaching any site functionality.
  if (url.pathname === "/birthday-hunt" || url.pathname.startsWith("/birthday-hunt/")) {
    return new Response("The birthday hunt has ended.", {
      status: 410,
      headers: {"content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex"},
    });
  }
  const blocked =
    url.pathname === "/scripts/birthday-selfie-migration.sql" ||
    url.pathname === "/scripts/check-birthday.cjs" ||
    url.pathname === "/scripts/birthday-schema.sql" ||
    url.pathname === "/editing-guide" ||
    url.pathname === "/editing-guide/" ||
    url.pathname === "/editing-guide.html" ||
    url.pathname.startsWith("/editing-guide/") ||
    url.pathname === "/.private" ||
    url.pathname === "/.private/" ||
    url.pathname.startsWith("/.private/");

  if (blocked) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }

  return context.next();
}
