import { NextResponse } from "next/server";
import { assertAdmin, getStore, saveStore, TRIAL_LIKES } from "@/lib/store";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }
  const body = await req.json().catch(() => ({}));
  const uuid = String(body.uuid || "").trim();
  if (!uuid || !uuid) {
    return NextResponse.json({ error: "uuid required" }, { status: 400 });
  }
  const store = await getStore();
  const now = Date.now();
  let device = store.devices[uuid];
  if (!device) {
    device = {
      uuid,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      note: "",
      active: false,
      expiresAt: null,
      trialLikesRemaining: TRIAL_LIKES
    };
    store.devices[uuid] = device;
  }
  if (typeof body.note === "string") device.note = body.note;
  if (typeof body.active === "boolean") device.active = body.active;
  if (body.expiresAt === null) device.expiresAt = null;
  else if (typeof body.expiresAt === "number") device.expiresAt = body.expiresAt;
  if (typeof body.extendDays === "number" && body.extendDays > 0) {
    const base = Math.max(device.expiresAt || now, now);
    device.expiresAt = base + body.extendDays * 24 * 60 * 60 * 1000;
    device.active = true;
  }
  if (typeof body.setDaysFromNow === "number" && body.setDaysFromNow >= 0) {
    device.expiresAt = now + body.setDaysFromNow * 24 * 60 * 60 * 1000;
    device.active = true;
  }
  device.updatedAt = now;
  try {
    await saveStore(store);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, device });
}

export async function DELETE(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }
  const uuid = new URL(req.url).searchParams.get("uuid")?.trim() || "";
  if (!uuid) return NextResponse.json({ error: "uuid required" }, { status: 400 });
  const store = await getStore();
  delete store.devices[uuid];
  await saveStore(store);
  return NextResponse.json({ ok: true });
}
