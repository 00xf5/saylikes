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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0f172a 100%)"
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#111827",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 20px 50px rgba(0,0,0,.35)"
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "inline-block",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              marginBottom: 12
            }}
          >
            SayHi Likes
          </div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Admin login</h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14, lineHeight: 1.45 }}>
            Use the same password as <code style={{ color: "#5eead4" }}>ADMIN_TOKEN</code> in
            Vercel → Project → Settings → Environment Variables.
          </p>
        </div>

        <label style={{ display: "block", fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>
          Password
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="ADMIN_TOKEN"
            disabled={busy}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={ghostBtn}
            disabled={busy}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>

        <button type="submit" disabled={busy || !password.trim()} style={btnStyle}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {err && (
          <p
            style={{
              marginTop: 14,
              marginBottom: 0,
              color: "#fecaca",
              background: "#7f1d1d",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14
            }}
          >
            {err}
          </p>
        )}
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #475569",
  background: "#fff",
  color: "#0f172a",
  fontSize: 16
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 10,
  border: 0,
  background: "#0f766e",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer"
};

const ghostBtn: React.CSSProperties = {
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#e2e8f0",
  cursor: "pointer"
};
