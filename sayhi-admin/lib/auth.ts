import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "sayhi_admin_session";

function expectedToken(): string {
  return (process.env.ADMIN_TOKEN || "").trim();
}

/** Stable session value — never put the raw token (can contain `?` etc.) in cookies. */
export function sessionToken(): string {
  const secret = expectedToken();
  if (!secret) return "";
  return createHmac("sha256", secret).update("sayhi-likes-admin-v1").digest("hex");
}

export function cookieName() {
  return COOKIE;
}

export function verifyPassword(input: string): { ok: boolean; reason?: string } {
  const expected = expectedToken();
  if (!expected) {
    return { ok: false, reason: "ADMIN_TOKEN is not set on the server (Vercel → Settings → Environment Variables)" };
  }
  const got = String(input || "").trim();
  if (!got) return { ok: false, reason: "Enter the admin password" };
  if (got !== expected) return { ok: false, reason: "Wrong password" };
  return { ok: true };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function readSessionFromRequest(req: Request): string {
  const header = req.headers.get("x-admin-token") || "";
  if (header && header.trim() === expectedToken()) return "header";

  const cookie = req.headers.get("cookie") || "";
  const parts = cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (!part.startsWith(`${COOKIE}=`)) continue;
    return decodeURIComponent(part.slice(COOKIE.length + 1));
  }
  return "";
}

export function isAuthed(req: Request): boolean {
  const expected = sessionToken();
  if (!expected) return false;
  const got = readSessionFromRequest(req);
  if (got === "header") return true;
  return safeEqualHex(got, expected);
}

export function assertAdmin(req: Request) {
  if (!expectedToken()) {
    throw new Response(
      JSON.stringify({ error: "Server misconfigured: ADMIN_TOKEN missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!isAuthed(req)) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge
  };
}
