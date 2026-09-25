PRAGMA foreign_keys=OFF;
ALTER TABLE auth_codes ADD COLUMN ip_hash TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE payments ADD COLUMN order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_auth_codes_ip ON auth_codes(ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id,expires_at DESC);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,name TEXT,plan TEXT NOT NULL,billing_type TEXT NOT NULL,provider TEXT NOT NULL,expected_amount_usd REAL NOT NULL,charged_currency TEXT,charged_amount_minor INTEGER,status TEXT NOT NULL DEFAULT 'created',provider_checkout_id TEXT,provider_payment_id TEXT,subscription_id TEXT,fulfillment_token_hash TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at DESC);CREATE INDEX IF NOT EXISTS idx_orders_provider_checkout ON orders(provider,provider_checkout_id);CREATE INDEX IF NOT EXISTS idx_orders_subscription ON orders(subscription_id);
CREATE TABLE IF NOT EXISTS processed_webhooks (provider TEXT NOT NULL,event_id TEXT NOT NULL,order_id TEXT,processed_at INTEGER NOT NULL,PRIMARY KEY(provider,event_id));
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
INSERT OR IGNORE INTO app_settings(key,value,updated_at,updated_by) VALUES('access_restrictions_enabled','0',strftime('%s','now')*1000,'system');
UPDATE app_settings SET value='0',updated_at=strftime('%s','now')*1000,updated_by='v14_migration' WHERE key='access_restrictions_enabled';
PRAGMA foreign_keys=ON;
