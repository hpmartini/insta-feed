import { NextResponse, type NextRequest } from "next/server";

const API_ORIGIN = new URL(process.env.API_URL ?? "http://localhost:3001").origin;
const PUBLIC_PAGES = ["/login", "/register"];

/** Öffentlicher Web-Origin: PUBLIC_ORIGIN, sonst Host/X-Forwarded-* (Browser können diese nicht seitenübergreifend fälschen). */
function webOrigin(req: NextRequest): string {
  if (process.env.PUBLIC_ORIGIN) return new URL(process.env.PUBLIC_ORIGIN).origin;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host).split(",")[0].trim();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? req.nextUrl.protocol.slice(0, -1);
  return `${proto}://${host}`;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    // Wie im Backend: fehlender Origin erlaubt, vorhandener muss der Web-Origin sein ("null" und Fremde → 403).
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin !== null && origin !== webOrigin(req)) {
      return NextResponse.json({ error: "forbidden origin" }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const headers = new Headers(req.headers);
    if (origin !== null) headers.set("origin", API_ORIGIN); // Backend vergleicht mit eigenem Origin
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  // Nur Cookie-Präsenz: Nachweis erbringt erst /auth/me in der Shell.
  if (!PUBLIC_PAGES.includes(pathname) && !req.cookies.has("session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico).*)"] };
