import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude static assets, internal paths, and existing API routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/pastes') ||
    pathname.includes('.') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Check if caller requested application/json specifically (automated tests / curl)
  const accept = request.headers.get('accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    const slug = pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!slug.includes('/')) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/api/pastes/${slug}`;
      return NextResponse.rewrite(rewriteUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
