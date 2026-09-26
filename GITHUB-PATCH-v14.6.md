# GitHub Manual Patch — v14.6

Upload/replace these exact paths:

1. `wrangler.jsonc`
2. `package.json`
3. `src/index.js`
4. `src/lib/auth.js`
5. `src/routes/auth/email-access.js` (new)
6. `public/index.html`
7. `public/login.html`
8. `public/checkout.html`
9. `public/service-worker.js`
10. `cloudflare/schema-v14.sql` (fresh databases only)
11. `cloudflare/migrate-v14-to-v14-6.sql` (new; run once on existing D1)

## One required database command
`npx wrangler d1 execute pupscene-db --remote --file=./cloudflare/migrate-v14-to-v14-6.sql`

If your real D1 database name is different, replace `pupscene-db`.

## Important
Preserve your real D1 `database_name` and `database_id` when replacing `wrangler.jsonc`.

After this patch, normal sign-in does not require Resend.
