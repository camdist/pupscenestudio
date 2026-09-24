PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email,created_at DESC);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free-daily' CHECK(plan IN ('free-daily','five-monthly','unlimited-monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('inactive','active','cancelled','expired','past_due')),
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  billing_type TEXT NOT NULL DEFAULT 'free' CHECK(billing_type IN ('free','one-time','subscription')),
  subscription_id TEXT,
  renewal_at INTEGER,
  valid_until INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,user_id TEXT,email TEXT NOT NULL,plan TEXT NOT NULL,provider TEXT,provider_payment_id TEXT UNIQUE,
  billing_type TEXT NOT NULL DEFAULT 'one-time',amount_usd REAL NOT NULL DEFAULT 0,currency TEXT,amount_paid REAL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS generation_events (
  id TEXT PRIMARY KEY,user_id TEXT,plan TEXT NOT NULL,created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_generation_user_time ON generation_events(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,admin_user_id TEXT NOT NULL,action TEXT NOT NULL,target_user_id TEXT,details_json TEXT,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT
);
INSERT OR IGNORE INTO app_settings(key,value,updated_at,updated_by) VALUES('access_restrictions_enabled','0',strftime('%s','now')*1000,'system');
