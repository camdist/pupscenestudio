# GitHub manual update — v14.4

Replace ONLY these 5 files in your existing v14.3 GitHub repository, preserving the same paths:

1. `wrangler.jsonc`
2. `src/routes/auth/request-code.js`
3. `public/index.html`
4. `public/login.html`
5. `public/service-worker.js`

Optional documentation files (not required for the live app):
- `RELEASE-v14.4.md`
- `GITHUB-PATCH-v14.4.md`

You do NOT need to replace your database schema or migration files for this patch.
You do NOT need to rerun a D1 migration for v14.4.
Cloudflare should auto-deploy after the GitHub commit if your repository is connected.

After deploy:
1. Confirm `PUPSCENE_FROM_EMAIL` is now `PupScene Studio <login@pupscenestudio.site>` in Worker variables.
2. Confirm `RESEND_API_KEY` still exists as a Cloudflare Secret.
3. Clear old OTP test rows if needed:
   `npx wrangler d1 execute pupscene-db --remote --command="DELETE FROM auth_codes WHERE email='campodigitalstudio@gmail.com';"`
4. Clear old service worker/site data once, or test in Incognito.
5. Visit `/login.html`, request a fresh code, then open `/`.
