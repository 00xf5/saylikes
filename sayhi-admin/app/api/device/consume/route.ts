import { NextResponse } from "next/server";
import { consumeTrial, getStore, licenseOf, saveStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const uuid = String(body.uuid || "").trim();
  const count = Number(body.count ?? 0);
  if (!uuid || uuid.length < 8) {
    return NextResponse.json({ active: false, message: "Invalid uuid" }, { status: 400 });
  }
  if (!Number.isFinite(count) || count < 0) {
    return NextResponse.json({ active: false, message: "Invalid count" }, { status: 400 });
  }
  const store = await getStore();
  const device = store.devices[uuid];
  if (!device) {
    return NextResponse.json(
      { active: false, trialLikesRemaining: 0, message: "Unknown device" },
      { status: 404 }
    );
  }
  consumeTrial(device, count);
  await saveStore(store);
  return NextResponse.json(licenseOf(store.devices[uuid]));
}
