# Security notes

* All `/api/*` handlers share `api/_lib/security.ts` (tokens, CORS, rate limits, role checks).
* Sessions: 1h access token / 14d refresh token (HS256, separate keys per token type). `JWT_SECRET` is mandatory in production.
* 2FA: the OTP is generated server-side (`crypto.randomInt`), delivered only through Telegram, and only an HMAC of it is placed in the signed `mfaToken`. 5 guesses per token, 5 min lifetime.
* Passwords are bcrypt hashes (cost 12). Legacy plaintext passwords are upgraded transparently on the next successful login. Minimum 10 chars, letters + numbers.
* Roles: `owner`/`admin` manage users, Telegram config and restores; `manager` can write data and trigger reports; `staff` is read-only on the web API. Only an owner can create or modify owner/admin accounts.
* Telegram Mini App endpoints require valid, fresh, signed `initData` (or a manager session). Client-supplied `telegramId`, `staffId`, `simulationStaffId` and `unsafeUser` are ignored.
* Webhook: `X-Telegram-Bot-Api-Secret-Token` must match `TELEGRAM_WEBHOOK_SECRET`. Re-register the webhook after setting it.
* Rotate: JWT secret, Telegram bot token(s), and Supabase keys if they were ever deployed with the previous code.
