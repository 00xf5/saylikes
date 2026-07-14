export const metadata = { title: "SayHi Likes Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0f172a", color: "#e2e8f0", fontFamily: "ui-sans-serif, system-ui" }}>
        {children}
      </body>
    </html>
  );
}
