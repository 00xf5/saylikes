"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      setErr("Wrong admin token");
      return;
    }
    router.replace("/admin");
  }

  return (
    <main style={{ maxWidth: 420, margin: "10vh auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Admin login</h1>
      <p style={{ color: "#94a3b8" }}>Enter ADMIN_TOKEN from your Vercel env.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>
          Login
        </button>
        {err && <p style={{ color: "#f87171" }}>{err}</p>}
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#fff",
  color: "#0f172a",
  fontSize: 16
};

const btnStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: 0,
  background: "#0f766e",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"
};
