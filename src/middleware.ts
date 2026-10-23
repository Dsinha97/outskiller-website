import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/join/", "/reset/"];

/** First line of defence only: pages and actions still check the user against the database. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get("hq_session")?.value;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      return NextResponse.next();
    } catch {
      /* fall through to sign-in */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
};
