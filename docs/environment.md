# Partna — Environment & Secrets Reference

Operational reference for the Supabase secrets the platform requires. This is
documentation only — it does not set or change any values.

Secrets are managed with the Supabase CLI:

```bash
supabase secrets list   --project-ref gxxffatdlyhrudxsgdje
supabase secrets set  NAME=value --project-ref gxxffatdlyhrudxsgdje
supabase secrets unset NAME       --project-ref gxxffatdlyhrudxsgdje
```

Frontend build-time variables live in `.env` as `VITE_*` (e.g. `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) and are bundled into the static site — never put a private
key in a `VITE_*` variable.

---

## ⚠️ Before going live with real users

- **`PESAPAL_ENV` must be `live`** (not `sandbox`) — otherwise real card/mobile-money
  payments are processed against the Pesapal sandbox and never settle.
- **`SMILEID_ENV` must be `production`** (not sandbox) — otherwise KYC checks run
  against Smile ID's test environment and do not perform real identity verification.
- Confirm `AT_SENDER_ID` is an Africa's Talking–approved alphanumeric sender ID for
  Uganda (handled separately).

---

## Required secrets

### Supabase platform (auto-provided by Supabase — do not edit)
| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Project API URL. Used by every Edge Function. |
| `SUPABASE_ANON_KEY` | Public anon key. Used by pre-auth flows (register/login/OTP). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS). Used by all server-side Edge Functions. |
| `SUPABASE_DB_URL` | Direct Postgres connection string. |
| `SUPABASE_JWKS` | JWKS for JWT verification (new key system). |
| `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` | New-format API keys. |

### Scheduler
| Secret | Purpose |
|---|---|
| `CRON_SECRET` | Shared secret the pg_cron scheduler sends in the `X-Cron-Secret` header. Required by `process-cashback-batch`, `check-subscription-status`, `process-campaign-nudges`, `process-card-subscriptions`. Requests without the matching header are rejected with 401. The same value is stored in the `cron.job` commands (see below). Rotate by updating both the secret and the four cron job commands. |

### Payments — Pesapal
| Secret | Purpose |
|---|---|
| `PESAPAL_CONSUMER_KEY` | Pesapal API consumer key. Used by `pesapal-initiate`, `pesapal-callback`, `pesapal-ipn`. |
| `PESAPAL_CONSUMER_SECRET` | Pesapal API consumer secret. |
| `PESAPAL_ENV` | `live` or `sandbox`. **Set to `live` for production.** |
| `APP_BASE_URL` | Fallback base URL for the post-payment redirect (used by `pesapal-callback`/`pesapal-initiate`). |

### SMS — Africa's Talking
| Secret | Purpose |
|---|---|
| `AT_API_KEY` | Africa's Talking API key. Used by `send-sms`, `send-otp-sms`, `send-transaction-receipt`. |
| `AT_USERNAME` | Africa's Talking account username. |
| `AT_SENDER_ID` | Approved alphanumeric sender ID (optional; falls back to shortcode). |

### Email — Resend
| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. Used by `send-admin-email` and `send-transaction-receipt`. |

### KYC — Smile ID
| Secret | Purpose |
|---|---|
| `SMILEID_PARTNER_ID` | Smile ID partner ID. Used by `smileid-verify`. |
| `SMILEID_API_KEY` | Smile ID API key. |
| `SMILEID_ENV` | `production` or sandbox. **Set to `production` for production.** |

---

## Scheduled jobs (pg_cron)

Four daily jobs call Edge Functions via `net.http_post`. Each command sends
`Authorization: Bearer <anon key>` (to pass the gateway) **and**
`X-Cron-Secret: <CRON_SECRET>` (the real authorization). Inspect them with:

```sql
select jobid, jobname, schedule, command from cron.job order by jobid;
```

| Job | Function | Schedule (UTC) |
|---|---|---|
| `process-cashback-batch-daily` | process-cashback-batch | 21:00 |
| `process-card-subscriptions-daily` | process-card-subscriptions | 21:00 |
| `check-subscription-status-daily` | check-subscription-status | 04:00 |
| `process-campaign-nudges-daily` | process-campaign-nudges | 05:00 |

If `CRON_SECRET` is rotated, update each job's command (`cron.alter_job`) with the
new value or the jobs will start returning 401.

---

## Notes

- Frontend fee constants live in `src/lib/constants.js`; the Edge-Function equivalents
  live in `supabase/functions/_shared/fees.ts`. Keep the two in sync.
- Three malformed secrets whose names were credential-like values
  (`re_…`, `atsk_…`, `partnaadmin`) were removed — do not re-add raw keys as secret
  names; the canonical keys are `RESEND_API_KEY` and `AT_API_KEY`.
