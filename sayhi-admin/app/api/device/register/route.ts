import { NextResponse } from "next/server";
import { getStore, licenseOf, saveStore, TRIAL_LIKES } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const uuid = String(body.uuid || "").trim();
  if (!uuid || uuid.length < 8) {
    return NextResponse.json({ active: false, message: "Invalid uuid" }, { status: 400 });
  }
  const store = await getStore();
  const now = Date.now();
  const existing = store.devices[uuid];
  if (!existing) {
    store.devices[uuid] = {
      uuid,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      note: "",
      active: false,
      expiresAt: null,
      trialLikesRemaining: TRIAL_LIKES
    };
  } else {
    existing.lastSeenAt = now;
    existing.updatedAt = now;
    if (typeof existing.trialLikesRemaining !== "number") {
      existing.trialLikesRemaining = TRIAL_LIKES;
    }
  }
  await saveStore(store);
  return NextResponse.json(licenseOf(store.devices[uuid]));
}
