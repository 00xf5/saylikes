import { ensureSchema, getSql } from "@/lib/db";

export const TRIAL_LIKES = 5;

export type Device = {
  uuid: string;
  createdAt: number;
  updatedAt: number;
  note: string;
  active: boolean;
  expiresAt: number | null;
  lastSeenAt: number;
  trialLikesRemaining: number;
  blocked: boolean;
  suspendedUntil: number | null;
};

export type HowTo = {
  text: string;
  videoUrl: string | null;
  updatedAt: number;
  adminWhatsApp: string;
  adminTelegram: string;
  priceWeeklyNgn: number;
  priceMonthlyNgn: number;
};

export type Store = {
  devices: Record<string, Device>;
  howto: HowTo;
};

const DEFAULT_HOWTO: HowTo = {
  text: `1) Enable Accessibility for SayHi Likes
2) Open SayHi on the Find tab
3) Press Start in the app
4) Tap Contact Admin on Telegram — your Device ID is sent automatically`,
  videoUrl: null,
  updatedAt: Date.now(),
  adminWhatsApp: "",
  adminTelegram: "godfather_bott",
  priceWeeklyNgn: 7000,
  priceMonthlyNgn: 20000
};

type DeviceRow = {
  uuid: string;
  created_at: string | number;
  updated_at: string | number;
  last_seen_at: string | number;
  note: string | null;
  active: boolean;
  expires_at: string | number | null;
  trial_likes_remaining: number | null;
  blocked: boolean;
  suspended_until: string | number | null;
};

type HowToRow = {
  text: string;
  video_url: string | null;
  updated_at: string | number;
  admin_whatsapp: string | null;
  admin_telegram: string | null;
  price_weekly_ngn: number | null;
  price_monthly_ngn: number | null;
};

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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

function rowToDevice(row: DeviceRow): Device {
  return normalizeDevice({
    uuid: row.uuid,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    lastSeenAt: num(row.last_seen_at),
    note: row.note ?? "",
    active: row.active === true,
    expiresAt: row.expires_at == null ? null : num(row.expires_at),
    trialLikesRemaining:
      row.trial_likes_remaining == null ? TRIAL_LIKES : num(row.trial_likes_remaining, TRIAL_LIKES),
    blocked: row.blocked === true,
    suspendedUntil: row.suspended_until == null ? null : num(row.suspended_until)
  });
}

function rowToHowTo(row: HowToRow | undefined): HowTo {
  if (!row) return { ...DEFAULT_HOWTO, updatedAt: Date.now() };
  return {
    text: row.text || DEFAULT_HOWTO.text,
    videoUrl: row.video_url || null,
    updatedAt: num(row.updated_at, Date.now()),
    adminWhatsApp: row.admin_whatsapp ?? "",
    adminTelegram: (row.admin_telegram || DEFAULT_HOWTO.adminTelegram).replace(/^@/, ""),
    priceWeeklyNgn: num(row.price_weekly_ngn, DEFAULT_HOWTO.priceWeeklyNgn),
    priceMonthlyNgn: num(row.price_monthly_ngn, DEFAULT_HOWTO.priceMonthlyNgn)
  };
}

export async function getStore(): Promise<Store> {
  await ensureSchema();
  const db = getSql();
  const deviceRows = (await db`SELECT * FROM devices`) as DeviceRow[];
  const howtoRows = (await db`SELECT * FROM howto WHERE id = 1 LIMIT 1`) as HowToRow[];

  const devices: Record<string, Device> = {};
  for (const row of deviceRows) {
    devices[row.uuid] = rowToDevice(row);
  }

  return {
    devices,
    howto: rowToHowTo(howtoRows[0])
  };
}

export async function saveStore(store: Store): Promise<void> {
  await ensureSchema();
  const db = getSql();
  const now = Date.now();

  // Upsert every device currently in memory
  for (const device of Object.values(store.devices)) {
    const d = normalizeDevice(device);
    await db`
      INSERT INTO devices (
        uuid, created_at, updated_at, last_seen_at, note, active, expires_at,
        trial_likes_remaining, blocked, suspended_until
      ) VALUES (
        ${d.uuid},
        ${d.createdAt},
        ${d.updatedAt || now},
        ${d.lastSeenAt},
        ${d.note},
        ${d.active},
        ${d.expiresAt},
        ${d.trialLikesRemaining},
        ${d.blocked},
        ${d.suspendedUntil}
      )
      ON CONFLICT (uuid) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        last_seen_at = EXCLUDED.last_seen_at,
        note = EXCLUDED.note,
        active = EXCLUDED.active,
        expires_at = EXCLUDED.expires_at,
        trial_likes_remaining = EXCLUDED.trial_likes_remaining,
        blocked = EXCLUDED.blocked,
        suspended_until = EXCLUDED.suspended_until
    `;
  }

  // Remove devices deleted from the in-memory store
  const keep = Object.keys(store.devices);
  if (keep.length === 0) {
    await db`DELETE FROM devices`;
  } else {
    await db`DELETE FROM devices WHERE NOT (uuid = ANY(${keep}))`;
  }

  const h = store.howto;
  await db`
    INSERT INTO howto (
      id, text, video_url, updated_at, admin_whatsapp, admin_telegram,
      price_weekly_ngn, price_monthly_ngn
    ) VALUES (
      1,
      ${h.text},
      ${h.videoUrl},
      ${h.updatedAt || now},
      ${h.adminWhatsApp || ""},
      ${(h.adminTelegram || DEFAULT_HOWTO.adminTelegram).replace(/^@/, "")},
      ${h.priceWeeklyNgn},
      ${h.priceMonthlyNgn}
    )
    ON CONFLICT (id) DO UPDATE SET
      text = EXCLUDED.text,
      video_url = EXCLUDED.video_url,
      updated_at = EXCLUDED.updated_at,
      admin_whatsapp = EXCLUDED.admin_whatsapp,
      admin_telegram = EXCLUDED.admin_telegram,
      price_weekly_ngn = EXCLUDED.price_weekly_ngn,
      price_monthly_ngn = EXCLUDED.price_monthly_ngn
  `;
}

export function storageMode(): {
  mode: "neon" | "ephemeral";
  ok: boolean;
  hint: string;
} {
  if (process.env.DATABASE_URL?.trim()) {
    return {
      mode: "neon",
      ok: true,
      hint: "Neon Postgres connected — devices persist."
    };
  }
  if (process.env.VERCEL) {
    return {
      mode: "ephemeral",
      ok: false,
      hint: "DATABASE_URL missing on Vercel. Add Neon connection string → redeploy."
    };
  }
  return {
    mode: "ephemeral",
    ok: false,
    hint: "DATABASE_URL missing — add Neon connection string to .env.local."
  };
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
    message: "No free likes left — contact admin on Telegram @godfather_bott"
  };
}

export function consumeTrial(device: Device, count: number): Device {
  if (hasPaidSub(device)) return device;
  const n = Math.max(0, Math.floor(count));
  device.trialLikesRemaining = Math.max(0, (device.trialLikesRemaining ?? 0) - n);
  device.updatedAt = Date.now();
  return device;
}

export { assertAdmin } from "@/lib/auth";
