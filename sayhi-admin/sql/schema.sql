-- SayHi Likes — Neon schema (devices + howto)

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
);

CREATE TABLE IF NOT EXISTS howto (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  text TEXT NOT NULL,
  video_url TEXT NULL,
  updated_at BIGINT NOT NULL,
  admin_whatsapp TEXT NOT NULL DEFAULT '',
  admin_telegram TEXT NOT NULL DEFAULT 'godfather_bott',
  price_weekly_ngn INT NOT NULL DEFAULT 7000,
  price_monthly_ngn INT NOT NULL DEFAULT 20000
);
