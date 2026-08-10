import { NextResponse } from "next/server";
import {
  cookieName,
  sessionCookieOptions,
  sessionToken,
  verifyPassword
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? body.token ?? "");
  const check = verifyPassword(password);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason || "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), sessionToken(), sessionCookieOptions(60 * 60 * 24 * 30));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), "", sessionCookieOptions(0));
  // clear legacy cookie too
  res.cookies.set("admin_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const { isAuthed } = await import("@/lib/auth");
  return NextResponse.json({ authenticated: isAuthed(req) });
}
