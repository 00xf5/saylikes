"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Device = {
  uuid: string;
  note: string;
  active: boolean;
  expiresAt: number | null;
  createdAt: number;
  lastSeenAt: number;
  trialLikesRemaining?: number;
};

function fmt(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [days, setDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [manualUuid, setManualUuid] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/devices", { cache: "no-store", credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load devices");
      setLoaded(true);
      return;
    }
    const data = await res.json();
    setDevices(data.devices || []);
    const n: Record<string, string> = {};
    for (const d of data.devices || []) n[d.uuid] = d.note || "";
    setNotes(n);
    setError("");
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return devices;
    return devices.filter(
      (d) =>
        d.uuid.toLowerCase().includes(s) ||
        (d.note || "").toLowerCase().includes(s)
    );
  }, [devices, q]);

  async function patch(uuid: string, body: Record<string, unknown>) {
    setBusy(uuid);
    setError("");
    const res = await fetch("/api/admin/device", {
      method: "PATCH",
      credentials: "include",
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
    const res = await fetch(`/api/admin/device?uuid=${encodeURIComponent(uuid)}`, {
      method: "DELETE",
      credentials: "include"
    });
    setBusy(null);
    if (res.ok) await load();
  }

  async function addManual() {
    const uuid = manualUuid.trim();
    if (uuid.length < 8) {
      setError("Paste a full Device ID");
      return;
    }
    await patch(uuid, { note: notes[uuid] || "Added manually", setDaysFromNow: 7 });
    setManualUuid("");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    router.replace("/admin/login");
  }

  if (!loaded) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "#94a3b8" }}>Loading admin…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>Devices</h1>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
            Activate subscriptions by Device ID from the Android app.
          </p>
        </div>
        <Link href="/admin/howto" style={navLink}>
          How-to / pricing
        </Link>
        <button onClick={logout} style={ghostBtn}>
          Logout
        </button>
      </header>

      {error && <p style={errorBox}>{error}</p>}

      <section style={{ ...card, marginTop: 20 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Add / activate Device ID</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={manualUuid}
            onChange={(e) => setManualUuid(e.target.value)}
            placeholder="Paste UUID from user"
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <button style={btn} onClick={addManual} disabled={!!busy}>
            Activate 7 days
          </button>
        </div>
      </section>

      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search UUID or note…"
          style={{ ...inputStyle, width: "100%", maxWidth: 420 }}
        />
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
        {filtered.length === 0 && (
          <p style={{ color: "#94a3b8" }}>
            No devices yet. User must open the Android app once so it registers.
          </p>
        )}
        {filtered.map((d) => {
          const expired = d.expiresAt != null && d.expiresAt < Date.now();
          const paid = d.active && !expired;
          const trial = d.trialLikesRemaining ?? 0;
          return (
            <div key={d.uuid} style={card}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <code style={{ color: "#f8fafc", fontSize: 13 }}>{d.uuid}</code>
                <span style={pill(paid)}>{paid ? "PAID ACTIVE" : "NO SUB"}</span>
                {trial > 0 && <span style={pillTrial}>TRIAL {trial} left</span>}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
                Last seen: {fmt(d.lastSeenAt)} · Expires: {fmt(d.expiresAt)} · Created:{" "}
                {fmt(d.createdAt)}
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
                  Set days
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
                  Extend
                </button>
                <button
                  disabled={busy === d.uuid}
                  style={btn}
                  onClick={() =>
                    patch(d.uuid, { active: true, expiresAt: null, note: notes[d.uuid] || "" })
                  }
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
                <button
                  disabled={busy === d.uuid}
                  style={ghostBtn}
                  onClick={() => patch(d.uuid, { note: notes[d.uuid] || "" })}
                >
                  Save note
                </button>
                <button disabled={busy === d.uuid} style={dangerBtn} onClick={() => remove(d.uuid)}>
                  Delete
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

const navLink: React.CSSProperties = {
  color: "#5eead4",
  textDecoration: "none",
  fontWeight: 600
};

const errorBox: React.CSSProperties = {
  color: "#fecaca",
  background: "#7f1d1d",
  borderRadius: 10,
  padding: "10px 12px",
  marginTop: 14
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

const pillTrial: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  background: "#713f12",
  color: "#fde68a"
};
