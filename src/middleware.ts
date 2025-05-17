import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/home", "/validation", "/history"];

export const middleware = (request: NextRequest) => {
  const token = request.cookies.get("token")?.value;
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  return isProtectedRoute && !token
    ? NextResponse.redirect(new URL("/login", request.url))
    : NextResponse.next();
};

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
