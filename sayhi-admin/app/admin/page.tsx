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

type StorageInfo = { mode: string; ok: boolean; hint: string };

function fmt(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to load devices");
      setLoaded(true);
      return;
    }
    setDevices(data.devices || []);
    setStorage(data.storage || null);
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
      (d) => d.uuid.toLowerCase().includes(s) || (d.note || "").toLowerCase().includes(s)
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
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Update failed — is Blob connected?");
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
      setError("Paste the full Device ID from the phone app");
      return;
    }
    await patch(uuid, {
      note: notes[uuid] || "Added from admin",
      setDaysFromNow: Number(days["_new"] || 7)
    });
    setManualUuid("");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    router.replace("/admin/login");
  }

  if (!loaded) {
    return (
      <main className="admin-shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-top">
        <div className="admin-brand">
          <div className="admin-brand-mark">SH</div>
          <div>
            <h1 className="admin-title">Devices</h1>
            <p className="admin-sub">{devices.length} registered · manage subscriptions by UUID</p>
          </div>
        </div>
        <div className="admin-actions">
          <Link className="btn btn-ghost" href="/admin/howto" style={{ textDecoration: "none" }}>
            How-to / pricing
          </Link>
          <button className="btn btn-ghost" onClick={() => load()}>
            Refresh
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {storage && (
        <div className={`banner ${storage.ok ? "banner-ok" : "banner-bad"}`}>
          <strong>Storage:</strong> {storage.mode.toUpperCase()} — {storage.hint}
        </div>
      )}

      {devices.length === 0 && storage?.ok && (
        <div className="banner banner-warn">
          No devices yet. On the phone: open <strong>SayHi Likes</strong> (updated APK pointing to
          saylikes.vercel.app). Copy the Device ID, or it will appear here after register. You can
          also paste it below and activate immediately.
        </div>
      )}

      {error && <div className="banner banner-bad">{error}</div>}

      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Activate Device ID</h2>
        <div className="row">
          <input
            className="field"
            style={{ flex: 1, minWidth: 240 }}
            value={manualUuid}
            onChange={(e) => setManualUuid(e.target.value)}
            placeholder="Paste Device ID from phone"
          />
          <input
            className="field"
            style={{ width: 90 }}
            value={days["_new"] || "7"}
            onChange={(e) => setDays((s) => ({ ...s, _new: e.target.value }))}
            placeholder="days"
          />
          <button className="btn" onClick={addManual} disabled={!!busy}>
            Activate
          </button>
        </div>
      </section>

      <div className="row" style={{ marginBottom: 10 }}>
        <input
          className="field"
          style={{ maxWidth: 360 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search UUID or note…"
        />
      </div>

      <section className="panel" style={{ overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing to show.
          </p>
        ) : (
          <div className="device-grid">
            {filtered.map((d) => {
              const expired = d.expiresAt != null && d.expiresAt < Date.now();
              const paid = d.active && !expired;
              const trial = d.trialLikesRemaining ?? 0;
              return (
                <div key={d.uuid} className="device-card panel" style={{ padding: 14 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <code>{d.uuid}</code>
                    <span className={`pill ${paid ? "pill-ok" : "pill-off"}`}>
                      {paid ? "PAID" : "UNPAID"}
                    </span>
                    {trial > 0 && <span className="pill pill-trial">TRIAL {trial}</span>}
                  </div>
                  <div className="muted">
                    Last seen {fmt(d.lastSeenAt)} · Expires {fmt(d.expiresAt)}
                  </div>
                  <input
                    className="field"
                    style={{ marginTop: 10 }}
                    value={notes[d.uuid] || ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [d.uuid]: e.target.value }))}
                    placeholder="Note (customer name / payment)"
                  />
                  <div className="row" style={{ marginTop: 10 }}>
                    <input
                      className="field"
                      style={{ width: 80 }}
                      placeholder="days"
                      value={days[d.uuid] || ""}
                      onChange={(e) => setDays((s) => ({ ...s, [d.uuid]: e.target.value }))}
                    />
                    <button
                      className="btn"
                      disabled={busy === d.uuid}
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
                      className="btn"
                      disabled={busy === d.uuid}
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
                      className="btn"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(d.uuid, {
                          active: true,
                          expiresAt: null,
                          note: notes[d.uuid] || ""
                        })
                      }
                    >
                      Unlimited
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy === d.uuid}
                      onClick={() => patch(d.uuid, { note: notes[d.uuid] || "" })}
                    >
                      Save note
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy === d.uuid}
                      onClick={() => patch(d.uuid, { active: false, note: notes[d.uuid] || "" })}
                    >
                      Disable
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={busy === d.uuid}
                      onClick={() => remove(d.uuid)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
