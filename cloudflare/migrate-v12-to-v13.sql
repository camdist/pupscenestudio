PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT);
INSERT OR IGNORE INTO app_settings(key,value,updated_at,updated_by) VALUES('access_restrictions_enabled','0',strftime('%s','now')*1000,'system');
ALTER TABLE entitlements RENAME TO entitlements_v12_old;
CREATE TABLE entitlements (
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
INSERT INTO entitlements(user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at)
SELECT user_id,
  CASE WHEN plan='3-storyboards' THEN 'five-monthly' WHEN plan='unlimited-monthly' THEN 'unlimited-monthly' ELSE 'free-daily' END,
  CASE WHEN plan='none' THEN 'active' ELSE status END,
  CASE WHEN plan='3-storyboards' THEN 5 ELSE 0 END,
  CASE WHEN plan='unlimited-monthly' THEN 'subscription' WHEN plan='3-storyboards' THEN 'one-time' ELSE 'free' END,
  subscription_id,renewal_at,
  CASE WHEN plan IN ('3-storyboards','unlimited-monthly') AND renewal_at IS NOT NULL THEN renewal_at ELSE NULL END,
  updated_at
FROM entitlements_v12_old;
DROP TABLE entitlements_v12_old;
ALTER TABLE payments ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'one-time';
PRAGMA foreign_keys=ON;
