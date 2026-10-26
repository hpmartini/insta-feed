import { NextResponse, type NextRequest } from 'next/server';

// Cheap presence check only; the API stays the authority.
export function middleware(req: NextRequest) {
  const has = req.cookies.has('instafeed_session');
  const auth = ['/login', '/register'].includes(req.nextUrl.pathname);
  if (!has && !auth) return NextResponse.redirect(new URL('/login', req.url));
  if (has && auth) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };
