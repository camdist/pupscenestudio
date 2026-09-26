PRAGMA foreign_keys=ON;

-- v14.8 authentication reset for pre-launch/test accounts.
-- Keeps users that have payment/order history, but clears every old session and OTP.
DELETE FROM sessions;
DELETE FROM auth_codes;

-- Remove test/free accounts with no commerce history so they can use the new Sign Up flow cleanly.
DELETE FROM users
WHERE lower(email) <> 'campodigitalstudio@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id=users.id)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id=users.id);

-- Reset the admin credential to the v14.8 one-time bootstrap state.
-- On the next admin login, the Worker accepts the temporary default once and stores its PBKDF2 hash.
UPDATE users
SET password_hash=NULL,
    password_salt=NULL,
    role='admin',
    status='active'
WHERE lower(email)='campodigitalstudio@gmail.com';
