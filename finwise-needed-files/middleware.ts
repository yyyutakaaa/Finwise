import { NextResponse } from 'next/server'

export async function middleware() {
  // Simple middleware for now - we'll enhance later
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register']
}