export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40, maxWidth: 560 }}>
      <h1 style={{ marginTop: 0 }}>SayHi Likes Admin</h1>
      <p style={{ color: "#94a3b8" }}>Manage Device IDs, subscriptions, and howto content.</p>
      <p>
        <a href="/admin/login" style={{ color: "#5eead4", fontWeight: 700, fontSize: 18 }}>
          Go to admin login →
        </a>
      </p>
    </main>
  );
}
