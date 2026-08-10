import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Add your Neon connection string to .env.local / Vercel env."
    );
  }
  if (!sql) sql = neon(url);
  return sql;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getSql();
      await db`
        CREATE TABLE IF NOT EXISTS devices (
          uuid TEXT PRIMARY KEY,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          last_seen_at BIGINT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at BIGINT NULL,
          trial_likes_remaining INT NOT NULL DEFAULT 5,
          blocked BOOLEAN NOT NULL DEFAULT FALSE,
          suspended_until BIGINT NULL
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS howto (
          id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          text TEXT NOT NULL,
          video_url TEXT NULL,
          updated_at BIGINT NOT NULL,
          admin_whatsapp TEXT NOT NULL DEFAULT '',
          admin_telegram TEXT NOT NULL DEFAULT 'godfather_bott',
          price_weekly_ngn INT NOT NULL DEFAULT 7000,
          price_monthly_ngn INT NOT NULL DEFAULT 20000
        )
      `;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
}
