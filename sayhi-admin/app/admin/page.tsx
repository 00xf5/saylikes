"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Device = {
  uuid: string;
  note: string;
  active: boolean;
  expiresAt: number | null;
  createdAt: number;
  lastSeenAt: number;
};

function fmt(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/admin/devices", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      setError("Failed to load devices");
      return;
    }
    const data = await res.json();
    setDevices(data.devices || []);
    const n: Record<string, string> = {};
    for (const d of data.devices || []) n[d.uuid] = d.note || "";
    setNotes(n);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(uuid: string, body: Record<string, unknown>) {
    setBusy(uuid);
    setError("");
    const res = await fetch("/api/admin/device", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid, ...body })
    });
    setBusy(null);
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      setError("Update failed");
      return;
    }
    await load();
  }

  async function remove(uuid: string) {
    if (!confirm(`Delete ${uuid}?`)) return;
    setBusy(uuid);
    const res = await fetch(`/api/admin/device?uuid=${encodeURIComponent(uuid)}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) await load();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, flex: 1 }}>Devices / Subscriptions</h1>
        <Link href="/admin/howto" style={{ color: "#5eead4" }}>
          How-to video
        </Link>
        <button onClick={logout} style={ghostBtn}>
          Logout
        </button>
      </header>
      <p style={{ color: "#94a3b8" }}>
        Users have no login. They show a Device ID (UUID). Activate by UUID below.
      </p>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {devices.length === 0 && <p style={{ color: "#94a3b8" }}>No devices registered yet. Open the Android app once.</p>}
        {devices.map((d) => {
          const expired = d.expiresAt != null && d.expiresAt < Date.now();
          const activeNow = d.active && !expired;
          return (
            <div key={d.uuid} style={card}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <code style={{ color: "#f8fafc", fontSize: 13 }}>{d.uuid}</code>
                <span style={pill(activeNow)}>{activeNow ? "ACTIVE" : "INACTIVE"}</span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
                Last seen: {fmt(d.lastSeenAt)} · Expires: {fmt(d.expiresAt)} · Created: {fmt(d.createdAt)}
              </div>
              <input
                value={notes[d.uuid] || ""}
                onChange={(e) => setNotes((s) => ({ ...s, [d.uuid]: e.target.value }))}
                placeholder="Note (name / payment)"
                style={{ ...inputStyle, marginTop: 10, width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <input
                  style={{ ...inputStyle, width: 90 }}
                  placeholder="days"
                  value={days[d.uuid] || ""}
                  onChange={(e) => setDays((s) => ({ ...s, [d.uuid]: e.target.value }))}
                />
                <button
                  disabled={busy === d.uuid}
                  style={btn}
                  onClick={() =>
                    patch(d.uuid, {
                      setDaysFromNow: Number(days[d.uuid] || 30),
                      note: notes[d.uuid] || ""
                    })
                  }
                >
                  Set days from now
                </button>
                <button
                  disabled={busy === d.uuid}
                  style={btn}
                  onClick={() =>
                    patch(d.uuid, {
                      extendDays: Number(days[d.uuid] || 30),
                      note: notes[d.uuid] || ""
                    })
                  }
                >
                  Extend days
                </button>
                <button
                  disabled={busy === d.uuid}
                  style={btn}
                  onClick={() => patch(d.uuid, { active: true, expiresAt: null, note: notes[d.uuid] || "" })}
                >
                  Unlimited
                </button>
                <button
                  disabled={busy === d.uuid}
                  style={ghostBtn}
                  onClick={() => patch(d.uuid, { active: false, note: notes[d.uuid] || "" })}
                >
                  Disable
                </button>
                <button disabled={busy === d.uuid} style={dangerBtn} onClick={() => remove(d.uuid)}>
                  Delete
                </button>
                <button
                  disabled={busy === d.uuid}
                  style={ghostBtn}
                  onClick={() => patch(d.uuid, { note: notes[d.uuid] || "" })}
                >
                  Save note
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 14,
  padding: 16
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #475569",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box"
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: 0,
  background: "#0f766e",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};

const ghostBtn: React.CSSProperties = {
  ...btn,
  background: "#334155"
};

const dangerBtn: React.CSSProperties = {
  ...btn,
  background: "#b91c1c"
};

function pill(on: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    background: on ? "#14532d" : "#7c2d12",
    color: on ? "#bbf7d0" : "#fed7aa"
  };
}
