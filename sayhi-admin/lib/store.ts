import { promises as fs } from "fs";
import path from "path";
import { put, list, del } from "@vercel/blob";

export const TRIAL_LIKES = 5;

export type Device = {
  uuid: string;
  createdAt: number;
  updatedAt: number;
  note: string;
  active: boolean;
  expiresAt: number | null; // epoch ms
  lastSeenAt: number;
  /** Free likes left for testing / trial. Paid sub ignores this. */
  trialLikesRemaining: number;
  /** Admin hard block — stops paid + trial until cleared. */
  blocked: boolean;
  /** Temporary suspension end (epoch ms). Null = not timed. */
  suspendedUntil: number | null;
};

export type HowTo = {
  text: string;
  videoUrl: string | null;
  updatedAt: number;
  adminWhatsApp: string; // legacy
  adminTelegram: string; // e.g. OOxf5 (no @)
  priceWeeklyNgn: number;
  priceMonthlyNgn: number;
};

export type Store = {
  devices: Record<string, Device>;
  howto: HowTo;
};

const DEFAULT: Store = {
  devices: {},
  howto: {
    text: `1) Enable Accessibility for SayHi Likes
2) Open SayHi on the Find tab
3) Press Start in the app
4) Tap Contact Admin on Telegram — your Device ID is sent automatically`,
    videoUrl: null,
    updatedAt: Date.now(),
    adminWhatsApp: "",
    adminTelegram: "OOxf5",
    priceWeeklyNgn: 7000,
    priceMonthlyNgn: 20000
  }
};

const LOCAL_FILE = path.join(process.cwd(), "data", "store.json");
const BLOB_PATHNAME = "sayhi-likes/store.json";

function normalizeDevice(d: Partial<Device> & { uuid: string }): Device {
  return {
    uuid: d.uuid,
    createdAt: d.createdAt ?? Date.now(),
    updatedAt: d.updatedAt ?? Date.now(),
    note: d.note ?? "",
    active: d.active ?? false,
    expiresAt: d.expiresAt ?? null,
    lastSeenAt: d.lastSeenAt ?? Date.now(),
    trialLikesRemaining:
      typeof d.trialLikesRemaining === "number" ? d.trialLikesRemaining : TRIAL_LIKES,
    blocked: d.blocked === true,
    suspendedUntil: typeof d.suspendedUntil === "number" ? d.suspendedUntil : null
  };
}

async function readLocal(): Promise<Store> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const devices: Record<string, Device> = {};
    for (const [k, v] of Object.entries(parsed.devices || {})) {
      devices[k] = normalizeDevice(v as Device);
    }
    return {
      devices,
      howto: { ...DEFAULT.howto, ...(parsed.howto || {}) }
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

async function writeLocal(store: Store) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function readBlob(): Promise<Store> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return readLocal();
  const listed = await list({ prefix: BLOB_PATHNAME, limit: 1, token });
  const hit = listed.blobs.find((b) => b.pathname === BLOB_PATHNAME) || listed.blobs[0];
  if (!hit) return structuredClone(DEFAULT);
  const res = await fetch(hit.url, { cache: "no-store" });
  if (!res.ok) return structuredClone(DEFAULT);
  const data = await res.json();
  const devices: Record<string, Device> = {};
  for (const [k, v] of Object.entries(data.devices || {})) {
    devices[k] = normalizeDevice(v as Device);
  }
  return {
    devices,
    howto: { ...DEFAULT.howto, ...(data.howto || {}) }
  };
}

async function writeBlob(store: Store) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return writeLocal(store);
  const listed = await list({ prefix: BLOB_PATHNAME, limit: 10, token });
  for (const b of listed.blobs) {
    if (b.pathname.startsWith("sayhi-likes/store")) {
      try {
        await del(b.url, { token });
      } catch {
        /* ignore */
      }
    }
  }
  await put(BLOB_PATHNAME, JSON.stringify(store, null, 2), {
    access: "public",
    token,
    contentType: "application/json",
    addRandomSuffix: false
  });
}

export async function getStore(): Promise<Store> {
  if (process.env.BLOB_READ_WRITE_TOKEN) return readBlob();
  return readLocal();
}

export async function saveStore(store: Store): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) return writeBlob(store);
  // On Vercel, local disk is ephemeral — writes vanish between requests
  if (process.env.VERCEL) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is missing on Vercel. Connect Blob Storage and redeploy, or devices will never persist."
    );
  }
  return writeLocal(store);
}

export function storageMode(): { mode: "blob" | "ephemeral"; ok: boolean; hint: string } {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { mode: "blob", ok: true, hint: "Vercel Blob connected — devices persist." };
  }
  if (process.env.VERCEL) {
    return {
      mode: "ephemeral",
      ok: false,
      hint: "No Blob token on this deploy. Devices will NOT save. Vercel → Storage → Blob → connect → redeploy."
    };
  }
  return { mode: "ephemeral", ok: true, hint: "Local file store (dev only)." };
}

function hasPaidSub(device: Device): boolean {
  if (!device.active) return false;
  if (device.expiresAt != null && device.expiresAt < Date.now()) return false;
  return true;
}

function isBlockedNow(device: Device): { blocked: boolean; message: string } {
  if (device.blocked) {
    return { blocked: true, message: "Suspended by admin — contact support" };
  }
  if (device.suspendedUntil != null && device.suspendedUntil > Date.now()) {
    const until = new Date(device.suspendedUntil).toLocaleString();
    return { blocked: true, message: `Suspended until ${until}` };
  }
  return { blocked: false, message: "" };
}

export function licenseOf(device: Device | undefined) {
  if (!device) {
    return {
      active: false,
      expiresAt: null as number | null,
      trialLikesRemaining: 0,
      subscription: false,
      blocked: false,
      suspendedUntil: null as number | null,
      message: "Unknown device — open the app once to register"
    };
  }

  const hold = isBlockedNow(device);
  if (hold.blocked) {
    return {
      active: false,
      expiresAt: device.expiresAt,
      trialLikesRemaining: Math.max(0, device.trialLikesRemaining ?? 0),
      subscription: false,
      blocked: true,
      suspendedUntil: device.suspendedUntil,
      message: hold.message
    };
  }

  // Timed suspension expired — clear for cleanliness on next read
  if (device.suspendedUntil != null && device.suspendedUntil <= Date.now()) {
    device.suspendedUntil = null;
  }

  const trial = Math.max(0, device.trialLikesRemaining ?? 0);
  const subscription = hasPaidSub(device);

  if (subscription) {
    return {
      active: true,
      expiresAt: device.expiresAt,
      trialLikesRemaining: trial,
      subscription: true,
      blocked: false,
      suspendedUntil: null,
      message: device.expiresAt == null ? "Active (unlimited)" : "Active subscription"
    };
  }

  if (trial > 0) {
    return {
      active: true,
      expiresAt: null,
      trialLikesRemaining: trial,
      subscription: false,
      blocked: false,
      suspendedUntil: null,
      message: `Trial: ${trial} free like${trial === 1 ? "" : "s"} left`
    };
  }

  if (device.expiresAt != null && device.expiresAt < Date.now()) {
    return {
      active: false,
      expiresAt: device.expiresAt,
      trialLikesRemaining: 0,
      subscription: false,
      blocked: false,
      suspendedUntil: null,
      message: "Subscription expired — contact admin on Telegram"
    };
  }

  return {
    active: false,
    expiresAt: device.expiresAt,
    trialLikesRemaining: 0,
    subscription: false,
    blocked: false,
    suspendedUntil: null,
    message: "No free likes left — contact admin on Telegram @OOxf5"
  };
}

export function consumeTrial(device: Device, count: number): Device {
  if (hasPaidSub(device)) return device;
  const n = Math.max(0, Math.floor(count));
  device.trialLikesRemaining = Math.max(0, (device.trialLikesRemaining ?? 0) - n);
  device.updatedAt = Date.now();
  return device;
}

// Re-export so existing API routes keep working
export { assertAdmin } from "@/lib/auth";

