import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  const isAuthPage = request.nextUrl.pathname === '/login'
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')
  const isPublic = request.nextUrl.pathname.startsWith('/_next') || 
                   request.nextUrl.pathname.startsWith('/favicon')

  if (isPublic || isApiAuth) return NextResponse.next()

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token) {
    const user = await verifyToken(token)
    if (!user && !isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
