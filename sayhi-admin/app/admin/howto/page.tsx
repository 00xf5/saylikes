"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HowToAdminPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [adminWhatsApp, setAdminWhatsApp] = useState("");
  const [priceWeeklyNgn, setPriceWeeklyNgn] = useState("7000");
  const [priceMonthlyNgn, setPriceMonthlyNgn] = useState("20000");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/devices", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      setText(data.howto?.text || "");
      setVideoUrl(data.howto?.videoUrl || null);
      setAdminWhatsApp(data.howto?.adminWhatsApp || "");
      setPriceWeeklyNgn(String(data.howto?.priceWeeklyNgn ?? 7000));
      setPriceMonthlyNgn(String(data.howto?.priceMonthlyNgn ?? 20000));
    })();
  }, [router]);

  async function save() {
    setMsg("Saving…");
    const form = new FormData();
    form.set("text", text);
    form.set("adminWhatsApp", adminWhatsApp);
    form.set("priceWeeklyNgn", priceWeeklyNgn);
    form.set("priceMonthlyNgn", priceMonthlyNgn);
    if (file) form.set("video", file);
    const res = await fetch("/api/admin/howto", { method: "POST", body: form });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Save failed");
      return;
    }
    setVideoUrl(data.howto?.videoUrl || null);
    setAdminWhatsApp(data.howto?.adminWhatsApp || "");
    setFile(null);
    setMsg("Saved");
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <p>
        <Link href="/admin" style={{ color: "#5eead4" }}>
          ← Devices
        </Link>
      </p>
      <h1>How to use (landing)</h1>
      <p style={{ color: "#94a3b8" }}>Shown in the Android app on every open. Contact Admin opens WhatsApp with Device ID pre-filled.</p>

      <label style={label}>Guide text</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={area} />

      <label style={label}>Admin WhatsApp (country code, digits only — e.g. 2348012345678)</label>
      <input value={adminWhatsApp} onChange={(e) => setAdminWhatsApp(e.target.value)} style={input} placeholder="2348012345678" />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={label}>Weekly price (₦)</label>
          <input value={priceWeeklyNgn} onChange={(e) => setPriceWeeklyNgn(e.target.value)} style={input} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={label}>Monthly price (₦)</label>
          <input value={priceMonthlyNgn} onChange={(e) => setPriceMonthlyNgn(e.target.value)} style={input} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={label}>Upload howto video (mp4)</label>
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {videoUrl && (
          <p style={{ color: "#94a3b8", wordBreak: "break-all" }}>
            Current:{" "}
            <a href={videoUrl} style={{ color: "#5eead4" }}>
              {videoUrl}
            </a>
          </p>
        )}
      </div>
      <button onClick={save} style={btn}>
        Save howto
      </button>
      {msg && <p>{msg}</p>}
    </main>
  );
}

const label: React.CSSProperties = { display: "block", marginTop: 14, marginBottom: 6, color: "#cbd5e1" };
const area: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "1px solid #475569",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
  fontSize: 15
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #475569",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
  fontSize: 15
};
const btn: React.CSSProperties = {
  marginTop: 16,
  padding: "12px 16px",
  borderRadius: 10,
  border: 0,
  background: "#0f766e",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"
};
