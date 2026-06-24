export async function onRequest(context) {
  const url = new URL(context.request.url);
  const blocked =
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
