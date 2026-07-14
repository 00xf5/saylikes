import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const store = await getStore();
  const h = store.howto;
  return NextResponse.json({
    text: h.text,
    videoUrl: h.videoUrl,
    updatedAt: h.updatedAt,
    adminWhatsApp: h.adminWhatsApp || "",
    adminTelegram: (h.adminTelegram || "OOxf5").replace(/^@/, ""),
    priceWeeklyNgn: h.priceWeeklyNgn ?? 7000,
    priceMonthlyNgn: h.priceMonthlyNgn ?? 20000
  });
}
