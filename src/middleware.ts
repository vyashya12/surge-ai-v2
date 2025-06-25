import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  
  if (token) {
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/auth/blacklist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { blacklisted } = await response.json();
      
      if (blacklisted) {
        return NextResponse.json({ error: "Token invalid" }, { status: 401 });
      }
    } catch (error) {
      // Continue if blacklist check fails
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"]
};