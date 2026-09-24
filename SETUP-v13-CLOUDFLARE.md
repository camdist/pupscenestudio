# PupScene Studio v13 — Cloudflare Full-Stack Setup

## What changed in v13

Pricing and access rules:

- **Free** — 1 successful Storyboard Generation per UTC day. Resets automatically each day.
- **$1** — 5 Storyboard Generations for a 30-day access period. Buyer may choose a one-time 30-day pass or monthly subscription.
- **$7.99** — Unlimited Storyboard Generation for a 30-day access period. Buyer may choose a one-time 30-day pass or monthly subscription.

The Admin dashboard includes **Access Restrictions**. It defaults to **OFF** for development/testing. While OFF, the Studio bypasses sign-in, credits, daily limits, plan expiry, and subscription entitlement checks. The Admin page itself remains protected.

Before public launch, sign in as `campodigitalstudio@gmail.com`, open `/admin.html`, and turn **Access Restrictions ON**.

## Fresh database setup

1. Create the D1 database:

```bash
npx wrangler d1 create pupscene-db --location=apac
```

2. Copy the returned database ID into `wrangler.jsonc` and uncomment the `d1_databases` block. Keep the binding name exactly `DB`.

3. Initialize the fresh v13 database:

```bash
npm run db:schema:remote
```

4. Deploy:

```bash
npm run deploy
```

## If you already initialized a v12 database

Do **not** run the fresh v13 schema over an existing v12 entitlement table. Run the one-time migration instead:

```bash
npm run db:migrate-v12-v13
```

This migration:
- creates the global app-settings table,
- changes the entitlement plans to `free-daily`, `five-monthly`, and `unlimited-monthly`,
- converts old `3-storyboards` accounts to `five-monthly`,
- adds billing type and 30-day validity fields,
- adds `billing_type` to existing payment records.

Run this migration only once on each v12 database.

## Admin testing toggle

1. Configure OTP email and sign in using:
   `campodigitalstudio@gmail.com`
2. Open:
   `/admin.html`
3. Use **Access Restrictions**:
   - OFF = unrestricted testing mode.
   - ON = production enforcement.

The setting is stored in D1, so it applies consistently across devices and browsers.

## Email OTP secrets

Set these in Cloudflare Worker Settings → Variables and Secrets:

- `RESEND_API_KEY` — Secret
- `PUPSCENE_FROM_EMAIL` — e.g. `PupScene Studio <login@pupscenestudio.site>`
- `ADMIN_EMAIL` — `campodigitalstudio@gmail.com`

Do not enable `DEV_OTP_ECHO=true` in production.

## Payment webhook secret

Add as a Cloudflare Secret:

- `PUPSCENE_PAYMENT_WEBHOOK_SECRET`

Your verified payment integration may send either paid plan:

- `five-monthly`
- `unlimited-monthly`

and should also provide:

- `billingType`: `one-time` or `subscription`
- `providerPaymentId`
- `status`
- payment amounts/currency
- optional `subscriptionId`, `renewalAt`, or `validUntil`

A paid one-time plan receives 30 days of access without automatic renewal. A paid subscription receives a 30-day validity/renewal period that your payment webhook should refresh after each successful renewal.

## Important production step

Before accepting real customers, turn **Access Restrictions ON** in Admin and verify:

- signed-out users are redirected to sign in,
- Free allows only one successful storyboard per UTC day,
- $1 accounts have 5 generations within the 30-day access period,
- Unlimited accounts have no PupScene generation count limit while active,
- expired one-time access is rejected,
- cancelled/expired subscriptions are rejected,
- only `campodigitalstudio@gmail.com` can use Admin APIs.
