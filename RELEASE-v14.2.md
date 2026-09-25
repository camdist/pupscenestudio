# PupScene Studio v14.2

- PayMongo hosted checkout now requests GCash + Maya (`gcash,paymaya`).
- Maya is no longer shown as a separate disabled provider; it appears under PayMongo.
- Direct Credit/Debit Card remains disabled.
- PayPal Client ID and Webhook ID are preconfigured as Worker variables.
- PayPal Client Secret remains a Cloudflare Secret and is intentionally not stored in this package.
- PayPal environment remains `sandbox` until you deliberately switch to live.


PayPal subscription plans are preconfigured in v14.3:
- PAYPAL_PLAN_FIVE = P-83D3293959555732LNK24J5I
- PAYPAL_PLAN_UNLIMITED = P-6BH16602A8593152FNK24LYQ
