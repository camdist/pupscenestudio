PRAGMA foreign_keys=OFF;

-- Rebuild the entitlements table so older PupScene databases accept the
-- current plan names used by v15+: free-daily, five-monthly, unlimited-monthly.
-- This migration only uses columns shared by the legacy and current tables,
-- so it works for the original v12 entitlement table and later variants.

DROP TABLE IF EXISTS entitlements_v15_legacy;
ALTER TABLE entitlements RENAME TO entitlements_v15_legacy;

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

INSERT INTO entitlements(
  user_id,plan,status,credits_remaining,billing_type,subscription_id,renewal_at,valid_until,updated_at
)
SELECT
  user_id,
  CASE
    WHEN plan='3-storyboards' THEN 'five-monthly'
    WHEN plan='five-monthly' THEN 'five-monthly'
    WHEN plan='unlimited-monthly' THEN 'unlimited-monthly'
    ELSE 'free-daily'
  END,
  CASE
    WHEN status IN ('inactive','active','cancelled','expired','past_due') THEN status
    ELSE 'active'
  END,
  CASE
    WHEN plan IN ('3-storyboards','five-monthly') THEN COALESCE(credits_remaining,0)
    ELSE 0
  END,
  CASE
    WHEN plan IN ('none','free-daily') THEN 'free'
    WHEN plan='unlimited-monthly' AND subscription_id IS NOT NULL THEN 'subscription'
    WHEN plan='five-monthly' AND renewal_at IS NOT NULL THEN 'subscription'
    WHEN plan='3-storyboards' THEN 'one-time'
    ELSE 'one-time'
  END,
  subscription_id,
  renewal_at,
  renewal_at,
  updated_at
FROM entitlements_v15_legacy;

DROP TABLE entitlements_v15_legacy;
PRAGMA foreign_keys=ON;
