# PupScene Studio v12 — Secure Account/Admin Setup

## Cloudflare bindings
Create a D1 database and bind it to this project as `DB`.
Run `cloudflare/schema-v12.sql` against that database before first login.

## Required environment variables / secrets
- `ADMIN_EMAIL=campodigitalstudio@gmail.com` (the backend also defaults to this address)
- `RESEND_API_KEY=<your email delivery API key>`
- `PUPSCENE_FROM_EMAIL=PupScene Studio <login@pupscenestudio.site>` after the domain is verified with your email provider
- `PUPSCENE_PAYMENT_WEBHOOK_SECRET=<long random secret>` for the generic payment webhook adapter

For local development only, `DEV_OTP_ECHO=true` makes `/api/auth/request-code` return the one-time code in the API response. Never enable this in production.

## Authentication model
Users sign in with a six-digit email code. Sessions are random server-side tokens stored as SHA-256 hashes in D1 and delivered in an HttpOnly, Secure, SameSite=Lax cookie.
Admin APIs require BOTH an authenticated session and the exact authorized admin email `campodigitalstudio@gmail.com` with role `admin`.

## Payment activation
`/api/webhooks/payment` is a secure generic adapter scaffold. Your chosen gateway integration should transform its verified webhook into a POST using header `x-pupscene-webhook-secret` and a JSON body including:
`email`, `plan`, `status`, `providerPaymentId`, optional `provider`, `amountUsd`, `currency`, `amountPaid`, `subscriptionId`, `renewalAt`.

Do not call this endpoint directly from browser JavaScript. The gateway webhook must be verified server-to-server first.

## Admin
Sign in using `campodigitalstudio@gmail.com`, then open `/admin.html`.
The dashboard can search users, suspend/reactivate accounts, change plans/credits, view billing records, and record verified manual/bank payments.

## Security notes
- API responses are no-store.
- Admin authorization is enforced server-side on every admin API request.
- Account and admin pages are never served by the service-worker cache.
- Thank You/install fulfillment checks authenticated entitlement before revealing fulfillment controls.
- Current CSP still allows inline scripts because the legacy Studio is a single-file app. A later refactor should move inline scripts into external JS files and remove `'unsafe-inline'` from CSP.
