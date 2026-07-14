"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Login failed");
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setErr("Network error — check your connection");
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="admin-brand" style={{ marginBottom: 16 }}>
          <div className="admin-brand-mark">SH</div>
          <div>
            <div className="admin-title" style={{ fontSize: 20 }}>
              SayHi Likes
            </div>
            <div className="admin-sub">Admin console</div>
          </div>
        </div>

        <label className="muted" style={{ display: "block", marginBottom: 6 }}>
          Password (= ADMIN_TOKEN on Vercel)
        </label>
        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter admin password"
            disabled={busy}
          />
          <button type="button" className="btn btn-ghost" onClick={() => setShow((s) => !s)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="submit"
          className="btn"
          style={{ width: "100%", marginTop: 14, padding: "12px 14px" }}
          disabled={busy || !password.trim()}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {err && <div className="err">{err}</div>}
      </form>
    </main>
  );
}
