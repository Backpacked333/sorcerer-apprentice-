import { NextResponse, type NextRequest } from "next/server";
import { WORKSPACE_COOKIE, WORKSPACE_PATTERN } from "./lib/workspace";

function newWorkspace(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function proxy(request: NextRequest) {
  const current = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const workspace = current && WORKSPACE_PATTERN.test(current) ? current : newWorkspace();
  request.cookies.set(WORKSPACE_COOKIE, workspace);
  const response = NextResponse.next({ request: { headers: request.headers } });
  if (workspace !== current) {
    response.cookies.set(WORKSPACE_COOKIE, workspace, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
