import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
