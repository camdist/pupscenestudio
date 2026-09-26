# GitHub patch instructions — v14.5

Replace only these files in your GitHub repository:

1. `wrangler.jsonc`
2. `package.json`

If your repo did not yet receive the v14.4 login fix, also replace:

3. `src/routes/auth/request-code.js`
4. `public/index.html`
5. `public/login.html`
6. `public/service-worker.js`

After GitHub auto-deploy completes, open Cloudflare and make sure the **Worker named `pupscenestudio`** has the following Production bindings/secrets:

- D1 binding: `DB` → your PupScene D1 database
- `RESEND_API_KEY` (Secret)
- `TURNSTILE_SECRET_KEY` (Secret)
- `PAYMONGO_SECRET_KEY` (Secret)
- `PAYMONGO_WEBHOOK_TOKEN` (Secret)
- `PAYPAL_CLIENT_SECRET` (Secret)

Normal variables should include:

- `PUPSCENE_FROM_EMAIL = PupScene Studio <login@pupscenestudio.site>`
- `ADMIN_EMAIL = campodigitalstudio@gmail.com`

Do not add secrets to GitHub.
