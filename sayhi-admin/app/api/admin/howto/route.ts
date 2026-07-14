import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { assertAdmin, getStore, saveStore } from "@/lib/store";

export const runtime = "nodejs";

function applyFields(
  store: Awaited<ReturnType<typeof getStore>>,
  fields: Record<string, FormDataEntryValue | string | number | null | undefined>
) {
  const text = fields.text;
  if (typeof text === "string") store.howto.text = text;

  const wa = fields.adminWhatsApp;
  if (typeof wa === "string") {
    store.howto.adminWhatsApp = wa.replace(/[^\d]/g, "");
  }

  const weekly = fields.priceWeeklyNgn;
  if (typeof weekly === "string" && weekly.trim()) {
    store.howto.priceWeeklyNgn = Number(weekly) || store.howto.priceWeeklyNgn;
  } else if (typeof weekly === "number") {
    store.howto.priceWeeklyNgn = weekly;
  }

  const monthly = fields.priceMonthlyNgn;
  if (typeof monthly === "string" && monthly.trim()) {
    store.howto.priceMonthlyNgn = Number(monthly) || store.howto.priceMonthlyNgn;
  } else if (typeof monthly === "number") {
    store.howto.priceMonthlyNgn = monthly;
  }

  if (fields.videoUrl === null) store.howto.videoUrl = null;
  else if (typeof fields.videoUrl === "string") store.howto.videoUrl = fields.videoUrl;
}

export async function POST(req: Request) {
  try {
    assertAdmin(req);
  } catch (e) {
    return e as Response;
  }

  const contentType = req.headers.get("content-type") || "";
  const store = await getStore();

  if (contentType.includes("application/json")) {
    const body = await req.json();
    applyFields(store, body);
    store.howto.updatedAt = Date.now();
    await saveStore(store);
    return NextResponse.json({ ok: true, howto: store.howto });
  }

  const form = await req.formData();
  applyFields(store, {
    text: form.get("text") ?? undefined,
    adminWhatsApp: form.get("adminWhatsApp") ?? undefined,
    priceWeeklyNgn: form.get("priceWeeklyNgn") ?? undefined,
    priceMonthlyNgn: form.get("priceMonthlyNgn") ?? undefined
  });

  const file = form.get("video");
  if (file && typeof file !== "string") {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "Set BLOB_READ_WRITE_TOKEN on Vercel to upload videos" },
        { status: 400 }
      );
    }
    const uploaded = await put(`sayhi-likes/howto-${Date.now()}.mp4`, file, {
      access: "public",
      token: blobToken,
      contentType: file.type || "video/mp4"
    });
    store.howto.videoUrl = uploaded.url;
  }

  store.howto.updatedAt = Date.now();
  await saveStore(store);
  return NextResponse.json({ ok: true, howto: store.howto });
}
