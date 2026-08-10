import { NextResponse } from "next/server";
import { assertAdmin, getStore, saveStore, TRIAL_LIKES, type Device } from "@/lib/store";

export const runtime = "nodejs";

function ensureDevice(store: Awaited<ReturnType<typeof getStore>>, uuid: string, now: number): Device {
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
      trialLikesRemaining: TRIAL_LIKES,
      blocked: false,
      suspendedUntil: null
    };
    store.devices[uuid] = device;
  }
  return device;
}

export async function PATCH(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }
  const body = await req.json().catch(() => ({}));
  const uuid = String(body.uuid || "").trim();
  if (!uuid) {
    return NextResponse.json({ error: "uuid required" }, { status: 400 });
  }

  try {
    const store = await getStore();
    const now = Date.now();
    const device = ensureDevice(store, uuid, now);

    if (typeof body.note === "string") device.note = body.note;

    // Clear suspension / block when activating paid access
    const activating =
      body.active === true ||
      body.expiresAt === null ||
      (typeof body.extendDays === "number" && body.extendDays > 0) ||
      (typeof body.setDaysFromNow === "number" && body.setDaysFromNow >= 0) ||
      body.unblock === true;

    if (typeof body.blocked === "boolean") {
      device.blocked = body.blocked;
      if (body.blocked) device.suspendedUntil = null;
    }

    if (body.suspendedUntil === null) {
      device.suspendedUntil = null;
    } else if (typeof body.suspendedUntil === "number") {
      device.suspendedUntil = body.suspendedUntil;
      device.blocked = false;
    }

    if (typeof body.suspendDays === "number" && body.suspendDays > 0) {
      device.suspendedUntil = now + body.suspendDays * 24 * 60 * 60 * 1000;
      device.blocked = false;
    }

    if (body.unblock === true) {
      device.blocked = false;
      device.suspendedUntil = null;
    }

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

    if (typeof body.trialLikesRemaining === "number" && body.trialLikesRemaining >= 0) {
      device.trialLikesRemaining = Math.floor(body.trialLikesRemaining);
    }

    if (activating) {
      device.blocked = false;
      device.suspendedUntil = null;
    }

    device.updatedAt = now;
    await saveStore(store);
    return NextResponse.json({ ok: true, device });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }
  const uuid = new URL(req.url).searchParams.get("uuid")?.trim() || "";
  if (!uuid) return NextResponse.json({ error: "uuid required" }, { status: 400 });
  try {
    const store = await getStore();
    delete store.devices[uuid];
    await saveStore(store);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
