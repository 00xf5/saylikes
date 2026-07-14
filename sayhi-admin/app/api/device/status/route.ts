import { NextResponse } from "next/server";
import { getStore, licenseOf } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const uuid = new URL(req.url).searchParams.get("uuid")?.trim() || "";
  if (!uuid) {
    return NextResponse.json({ active: false, message: "Missing uuid" }, { status: 400 });
  }
  const store = await getStore();
  return NextResponse.json(licenseOf(store.devices[uuid]));
}
