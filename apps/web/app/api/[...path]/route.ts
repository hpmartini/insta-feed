// Same-origin proxy to the Bun API. A rewrite would forward the browser's Origin (web) to an API that
// compares it with its own origin and answers 403, so we validate it here and re-stamp it for the backend.
const API_ORIGIN = new URL(process.env.API_INTERNAL_URL ?? "http://localhost:3001").origin;

export const dynamic = "force-dynamic";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  // Same rule as the backend: absent Origin is fine, a present one must be this web origin.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin !== null && origin !== url.origin) {
    return Response.json({ error: "forbidden origin" }, { status: 403 });
  }
  const { path } = await params;
  const target = new URL(`${API_ORIGIN}/${path.map(encodeURIComponent).join("/")}${url.search}`);
  const headers = new Headers();
  for (const h of ["cookie", "content-type", "accept"]) {
    const v = req.headers.get(h);
    if (v !== null) headers.set(h, v);
  }
  if (origin !== null) headers.set("origin", target.origin);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(target, { method: req.method, headers, body: hasBody ? await req.arrayBuffer() : undefined, redirect: "manual" });
  const out = new Headers({ "cache-control": "no-store" });
  const ct = res.headers.get("content-type");
  if (ct) out.set("content-type", ct);
  for (const c of res.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
