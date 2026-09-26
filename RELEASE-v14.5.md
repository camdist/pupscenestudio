# PupScene Studio v14.5 — Worker Name Alignment Fix

This patch aligns the Cloudflare Worker service name with the actual deployed Worker: `pupscenestudio`.

## Why this matters
Cloudflare Worker secrets, D1 bindings, routes/custom domains, and deployments belong to a specific Worker service. If Wrangler deploys `pupscene-studio` while the live custom domain and secrets belong to `pupscenestudio`, you can end up with two separate Workers. The live domain may then keep serving an older build or a Worker without the expected secrets.

## Changed files
- `wrangler.jsonc` — Worker name changed to `pupscenestudio`.
- `package.json` — package name/version aligned for clarity.

No database schema change is included.
