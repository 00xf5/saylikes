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
  blocked?: boolean;
  suspendedUntil?: number | null;
};

type StorageInfo = { mode: string; ok: boolean; hint: string };

function fmt(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function statusOf(d: Device) {
  const now = Date.now();
  if (d.blocked) return { label: "BLOCKED", kind: "bad" as const };
  if (d.suspendedUntil && d.suspendedUntil > now) {
    return { label: "SUSPENDED", kind: "warn" as const };
  }
  const expired = d.expiresAt != null && d.expiresAt < now;
  if (d.active && !expired) return { label: "PAID", kind: "ok" as const };
  if ((d.trialLikesRemaining ?? 0) > 0) return { label: "TRIAL", kind: "trial" as const };
  return { label: "INACTIVE", kind: "off" as const };
}

export default function AdminPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [days, setDays] = useState<Record<string, string>>({});
  const [suspendDays, setSuspendDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [manualUuid, setManualUuid] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleDevice(uuid: string) {
    setExpanded((s) => ({ ...s, [uuid]: !s[uuid] }));
  }

  function shortUuid(uuid: string) {
    if (uuid.length <= 16) return uuid;
    return `${uuid.slice(0, 8)}…${uuid.slice(-6)}`;
  }

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

  async function patch(uuid: string, body: Record<string, unknown>, success = "Saved") {
    setBusy(uuid);
    setError("");
    setOkMsg("");
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Update failed — is Blob connected?");
      return;
    }
    setOkMsg(`${success}: ${uuid.slice(0, 8)}…`);
    setExpanded((s) => ({ ...s, [uuid]: true }));
    await load();
  }

  async function remove(uuid: string) {
    if (!confirm(`Permanently delete ${uuid}?`)) return;
    setBusy(uuid);
    setError("");
    const res = await fetch(`/api/admin/device?uuid=${encodeURIComponent(uuid)}`, {
      method: "DELETE",
      credentials: "include"
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      return;
    }
    setOkMsg("Deleted");
    await load();
  }

  async function addManual() {
    const uuid = manualUuid.trim();
    if (uuid.length < 8) {
      setError("Paste the full Device ID from the phone app");
      return;
    }
    await patch(
      uuid,
      {
        note: notes[uuid] || "Added from admin",
        setDaysFromNow: Number(days["_new"] || 7),
        unblock: true
      },
      "Activated"
    );
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
            <p className="admin-sub">{devices.length} registered · manage by Device ID</p>
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

      {okMsg && <div className="banner banner-ok">{okMsg}</div>}
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

      <section className="panel">
        {filtered.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing to show.
          </p>
        ) : (
          <div className="device-grid">
            {filtered.map((d) => {
              const st = statusOf(d);
              const trial = d.trialLikesRemaining ?? 0;
              const isOpen = !!expanded[d.uuid];
              const pillClass =
                st.kind === "ok"
                  ? "pill-ok"
                  : st.kind === "trial"
                    ? "pill-trial"
                    : st.kind === "warn" || st.kind === "bad"
                      ? "pill-off"
                      : "pill-off";
              const note = notes[d.uuid] || d.note || "";
              return (
                <div key={d.uuid} className={`device-accordion${isOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="device-accordion-header"
                    onClick={() => toggleDevice(d.uuid)}
                    aria-expanded={isOpen}
                  >
                    <div className="device-accordion-main">
                      <div className="device-accordion-title">
                        <code title={d.uuid}>{shortUuid(d.uuid)}</code>
                        <span className={`pill ${pillClass}`}>{st.label}</span>
                        {trial > 0 && st.kind !== "bad" && st.kind !== "warn" && (
                          <span className="pill pill-trial">{trial} trial</span>
                        )}
                      </div>
                      <div className="device-accordion-meta">
                        {note ? `${note} · ` : ""}
                        Last seen {fmt(d.lastSeenAt)}
                        {d.suspendedUntil && d.suspendedUntil > Date.now()
                          ? ` · Suspended until ${fmt(d.suspendedUntil)}`
                          : ""}
                      </div>
                    </div>
                    <span className="device-accordion-chevron" aria-hidden>
                      ▼
                    </span>
                  </button>

                  <div className="device-accordion-body">
                    <p className="muted" style={{ margin: "12px 0 6px", wordBreak: "break-all" }}>
                      <code>{d.uuid}</code>
                    </p>
                    <div className="muted" style={{ marginBottom: 10 }}>
                      Sub expires {fmt(d.expiresAt)} · Created {fmt(d.createdAt)}
                    </div>

                    <input
                      className="field"
                      value={notes[d.uuid] || ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [d.uuid]: e.target.value }))}
                      placeholder="Note (customer name / payment)"
                    />

                  <p className="muted" style={{ margin: "12px 0 6px", fontWeight: 600 }}>
                    Subscription
                  </p>
                  <div className="row-actions">
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
                        patch(
                          d.uuid,
                          {
                            setDaysFromNow: Number(days[d.uuid] || 30),
                            note: notes[d.uuid] || "",
                            unblock: true
                          },
                          "Set days"
                        )
                      }
                    >
                      Set days
                    </button>
                    <button
                      className="btn"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(
                          d.uuid,
                          {
                            extendDays: Number(days[d.uuid] || 30),
                            note: notes[d.uuid] || "",
                            unblock: true
                          },
                          "Extended"
                        )
                      }
                    >
                      Extend
                    </button>
                    <button
                      className="btn"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(
                          d.uuid,
                          {
                            active: true,
                            expiresAt: null,
                            note: notes[d.uuid] || "",
                            unblock: true
                          },
                          "Unlimited"
                        )
                      }
                    >
                      Unlimited
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(d.uuid, { note: notes[d.uuid] || "" }, "Note saved")
                      }
                    >
                      Save note
                    </button>
                  </div>

                  <p className="muted" style={{ margin: "14px 0 6px", fontWeight: 600 }}>
                    Suspend / block
                  </p>
                  <div className="row-actions">
                    <input
                      className="field"
                      style={{ width: 80 }}
                      placeholder="days"
                      value={suspendDays[d.uuid] || "3"}
                      onChange={(e) =>
                        setSuspendDays((s) => ({ ...s, [d.uuid]: e.target.value }))
                      }
                    />
                    <button
                      className="btn btn-ghost"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(
                          d.uuid,
                          {
                            suspendDays: Number(suspendDays[d.uuid] || 3),
                            note: notes[d.uuid] || ""
                          },
                          "Suspended"
                        )
                      }
                    >
                      Suspend N days
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(
                          d.uuid,
                          { blocked: true, note: notes[d.uuid] || "" },
                          "Blocked"
                        )
                      }
                    >
                      Block now
                    </button>
                    <button
                      className="btn"
                      disabled={busy === d.uuid}
                      onClick={() =>
                        patch(
                          d.uuid,
                          { unblock: true, note: notes[d.uuid] || "" },
                          "Unblocked"
                        )
                      }
                    >
                      Unblock
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
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
