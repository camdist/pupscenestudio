# PupScene Studio v14.2 — ELI10 Manual Setup

This package already includes the public Turnstile site key, the requested sender display, PayMongo/GCash/Maya + PayPal checkout UI, and the PupScene black/white/pale-peach branding with the same font stack on every page.

## Important security rule

The two PayMongo values you supplied are **secrets**. They are deliberately NOT stored inside this ZIP, HTML, JavaScript, `wrangler.jsonc`, or GitHub-safe files. Put them into Cloudflare Secrets only.

## 1. Keep your D1 binding

Open `wrangler.jsonc` and make sure the `d1_databases` block uses your real D1 database ID and binding name `DB`.

## 2. Install dependencies and log in

```bash
npm install
npx wrangler login
```

## 3. Add the PayMongo secret key

Run:

```bash
npx wrangler secret put PAYMONGO_SECRET_KEY
```

Cloudflare will ask for the value. Paste your live PayMongo secret key there. Do not put it in a source file.

## 4. Add the PayMongo webhook token

Run:

```bash
npx wrangler secret put PAYMONGO_WEBHOOK_TOKEN
```

Paste your webhook token when prompted.

## 5. Turnstile

The public `TURNSTILE_SITE_KEY` is already in `wrangler.jsonc`. You still need the matching secret from Cloudflare Turnstile:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste the Turnstile Secret Key, not the Site Key.

## 6. Resend login email

Keep/add:

```bash
npx wrangler secret put RESEND_API_KEY
```

The package is configured to request this sender display:

`PupScene Studio <campodigitalstudio@gmail.com>`

**Heads-up:** Resend normally requires the `From` address/domain to be verified. If Resend rejects Gmail as the sender, use a verified `@pupscenestudio.site` address for `PUPSCENE_FROM_EMAIL` and use `campodigitalstudio@gmail.com` as your support/reply-to address instead.

## 7. PayMongo webhook URL

In PayMongo, use your live PupScene endpoint:

`https://www.pupscenestudio.site/api/webhooks/paymongo?token=YOUR_WEBHOOK_TOKEN`

Use the same secret token you stored as `PAYMONGO_WEBHOOK_TOKEN`.

## 8. PayPal

The PayPal Client ID and Webhook ID you supplied are already configured as Worker variables in `wrangler.jsonc`.

For security, the PayPal Client Secret is NOT stored in this package. Add it once as a Cloudflare Secret:

```bash
npx wrangler secret put PAYPAL_CLIENT_SECRET
```

Paste your PayPal Client Secret only when Wrangler asks for it.

`PAYPAL_ENV` is still set to `sandbox` for safe testing. If your supplied PayPal credentials are live credentials, do not switch to live until you have completed the Sandbox flow and created the matching production webhook.

For monthly subscription checkout you still need PayPal billing plan IDs:

- `PAYPAL_PLAN_FIVE`
- `PAYPAL_PLAN_UNLIMITED`

These can be normal Worker variables or Secrets.

## 9. Payment options in this build

Available now:
- PayMongo / GCash / Maya
- PayPal

Temporarily disabled with a friendly note:
- Direct Credit / Debit Card

The backend rejects those disabled payment choices even if someone manually modifies the page.

## 10. Deploy

```bash
npm run deploy
```

## 11. Test these pages

- `https://www.pupscenestudio.site/`
- `https://www.pupscenestudio.site/login.html`
- `https://www.pupscenestudio.site/account.html`
- `https://www.pupscenestudio.site/admin.html`
- `https://www.pupscenestudio.site/checkout.html`
- `https://www.pupscenestudio.site/api/app-settings`

## 12. Before accepting real money

1. Verify OTP email delivery.
2. Verify Turnstile.
3. Complete one real/small PayMongo transaction.
4. Confirm the PayMongo webhook changes the matching order to paid.
5. Confirm the correct plan appears in Account and Admin.
6. Confirm duplicate webhooks do not add credits twice.
7. Confirm refunds/cancellations affect only the matching purchase.
8. Test PayPal separately.
9. Keep direct card disabled until you finish its setup.
