import { NextResponse } from "next/server";
import { assertAdmin, getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }
  const store = await getStore();
  const devices = Object.values(store.devices).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  return NextResponse.json({ devices, howto: store.howto });
}
