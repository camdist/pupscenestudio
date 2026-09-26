# PupScene Studio v14.4 — Login Reliability Patch

Changes:
- Verified-domain OTP sender is now `PupScene Studio <login@pupscenestudio.site>`.
- Resend failures are logged safely to Cloudflare Worker logs with provider status/details.
- Failed email sends delete the unused OTP row so they do not cause an immediate `wait_before_retry` lockout.
- Login page shows friendly messages for retry/rate-limit/email errors.
- Main Studio access check has a 6-second network timeout and 6.5-second watchdog.
- If access checking stalls, users see **Sign In** and **Retry** instead of an endless loading screen.
- PWA cache bumped to `pupscene-v14-4`.
