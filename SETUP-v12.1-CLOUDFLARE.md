# PupScene Studio v12.1 — Cloudflare Full-Stack Deployment

This package fixes the Cloudflare error: **“Bindings cannot be added to a Worker that only has static assets.”**

It deploys PupScene as one full-stack Cloudflare Worker:

- `public/` — HTML, PWA, CSS/JS, icons and static assets
- `src/index.js` — Worker backend entry point
- `src/routes/` — auth, account, generation, admin, billing and webhook routes
- `cloudflare/schema-v12.sql` — D1 schema
- `wrangler.jsonc` — Worker + Assets configuration

Cloudflare serves normal static files directly, while `/api/*` requests invoke the Worker backend first.

## A. Install prerequisites
1. Install Node.js LTS if needed: https://nodejs.org/
2. Open Terminal / PowerShell in this folder.
3. Run:

```bash
npm install
npx wrangler login
```

## B. Create D1

```bash
npx wrangler d1 create pupscene-db --location=apac
```

Copy the returned `database_id`.

Open `wrangler.jsonc`, uncomment the `d1_databases` block, and replace:

`REPLACE_WITH_YOUR_D1_DATABASE_ID`

with the actual ID.

The binding name must remain exactly:

`DB`

## C. Create the database tables

Local test first:

```bash
npm run db:schema:local
```

Production D1:

```bash
npm run db:schema:remote
```

Verify:

```bash
npx wrangler d1 execute pupscene-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## D. Add production secrets

Never place secret values in `wrangler.jsonc`.

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PUPSCENE_PAYMENT_WEBHOOK_SECRET
```

Paste each real value only when Wrangler prompts you.

`ADMIN_EMAIL` is already set to `campodigitalstudio@gmail.com` in `wrangler.jsonc`.

`PUPSCENE_FROM_EMAIL` is set to `PupScene Studio <login@pupscenestudio.site>`. Use it only after the domain is verified with your email provider.

For temporary local testing only, put this in `.dev.vars`:

```text
DEV_OTP_ECHO=true
```

Do not set `DEV_OTP_ECHO=true` in production.

## E. Run locally

```bash
npm run dev
```

Open the local URL Wrangler shows. Test `/login.html`, `/account.html`, and `/admin.html`.

## F. Deploy

```bash
npm run deploy
```

This is no longer a static-assets-only deployment because `main` points to `src/index.js`.

After deployment, Cloudflare Dashboard will also allow Worker bindings because this project contains Worker code.

## G. Custom domain

In Cloudflare Dashboard, attach `www.pupscenestudio.site` to this Worker after your domain is ready. Keep the login sender and checkout redirect URLs aligned with the final domain.

## H. Resend OTP email
1. Verify `pupscenestudio.site` in Resend.
2. Create a sending API key.
3. Save it with `npx wrangler secret put RESEND_API_KEY`.
4. Sign in using `campodigitalstudio@gmail.com`.
5. The backend automatically upgrades that exact email to the `admin` role.
6. Open `/admin.html`.

## I. Payment webhook secret
Create a random 32–64+ character value and save it with:

```bash
npx wrangler secret put PUPSCENE_PAYMENT_WEBHOOK_SECRET
```

The generic `/api/webhooks/payment` endpoint is an internal entitlement adapter. Do **not** expose that secret in browser JavaScript. Your real payment provider webhook must be verified server-side before forwarding normalized payment data to this adapter or equivalent backend logic.

## J. Maya / real gateway
The current checkout UI is prepared, but real transaction creation and Maya signature verification still need gateway-specific server routes once you have your merchant sandbox credentials. Do not grant access solely from a browser redirect.

## K. Recommended first deployment test
1. Create D1 and apply schema.
2. Deploy.
3. Configure Resend.
4. Sign in with `campodigitalstudio@gmail.com`.
5. Confirm `/admin.html` works.
6. Sign in with a different email and confirm `/admin.html` returns access denied.
7. Use Admin to record a test manual payment and verify entitlement changes.
8. Only then connect the real payment gateway.

## Troubleshooting
### “Bindings cannot be added to a Worker that only has static assets.”
Deploy this full package with `npm run deploy`. It contains `src/index.js`, so it is a Worker script + static assets deployment.

### API says `database_not_configured`
The D1 block in `wrangler.jsonc` is still commented, has the wrong database ID, or the Worker was not redeployed after editing it.

### OTP says `email_service_not_configured`
`RESEND_API_KEY` is missing and production does not allow development OTP echo.

### Admin access denied
Sign in with exactly `campodigitalstudio@gmail.com`. Admin access also requires a valid server-side session.
