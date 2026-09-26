# IMPORTANT — v14.5 Cloudflare Worker name

The Worker service name in this package is **`pupscenestudio`**. This must match the Worker in Cloudflare that owns `www.pupscenestudio.site`, your D1 binding, and your Production secrets.

If you previously deployed a Worker called `pupscene-studio`, treat it as a separate Worker. Do not assume its secrets/bindings carry over automatically.

# PupScene Studio v14.1

Start with `SETUP-v14.1-ELI10.md`.

Do not store live payment or email API secrets in source files. Use `wrangler secret put ...` so Cloudflare keeps them encrypted.


PayPal subscription plans are preconfigured in v14.3:
- PAYPAL_PLAN_FIVE = P-83D3293959555732LNK24J5I
- PAYPAL_PLAN_UNLIMITED = P-6BH16602A8593152FNK24LYQ
