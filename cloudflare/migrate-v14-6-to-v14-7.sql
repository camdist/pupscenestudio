-- PupScene Studio v14.7
-- One-time cleanup for pre-v14.6 passwordless TEST/FREE accounts.
-- SECURITY: only removes passwordless users that have NO order and NO payment records.
-- Paid/order-linked legacy accounts are preserved and must use a verified recovery flow later.
PRAGMA foreign_keys=ON;

DELETE FROM users
WHERE (password_hash IS NULL OR TRIM(password_hash) = '')
  AND (password_salt IS NULL OR TRIM(password_salt) = '')
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id = users.id)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id);
