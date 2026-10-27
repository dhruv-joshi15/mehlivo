# Supabase and Vercel setup

Prisma CLI and Client are 6.19.3. The active schema is PostgreSQL; runtime uses
`DATABASE_URL`, while Prisma migrations use `DIRECT_URL` through `directUrl`.
Better Auth uses its Prisma PostgreSQL adapter, not Supabase Auth.

## Private local configuration

Open `.env.local` in the repository root. Paste the exact Supabase Connect → ORM →
Prisma DATABASE_URL and DIRECT_URL values inside the matching quotes. Do not paste
credentials into chat. Replace any password placeholder in the URLs using the
URL-encoded database password. Keep any supplied pooling/TLS query parameters.
The file is ignored and has owner-only permissions. A random auth secret is
already generated there; preserve it across restarts and deployments.

Next.js loads `.env.local` automatically. `prisma.config.ts` loads it for Prisma;
the migration script loads it too. Exported shell/Vercel variables take precedence.
The old `.env` is preserved for reference but is not the PostgreSQL CLI source.
Restart Next.js after changing the file. Do not use `NEXT_PUBLIC_` for these values.

Set `AUTH_TESTER_EMAILS=tester@mehlivo.test` for the approved tester, or use
comma-separated exact invited email addresses.
`AUTH_TESTER_MODE=true` enables restricted signup and suppresses signup verification
mail. Empty allowlist denies every signup. Password signup and login work without
email delivery; verification is not required. Password reset and verification-email
requests are disabled in tester mode. Existing accounts can still sign in; this
is a signup restriction, not an access revocation system. Keep tester mode enabled
until a separate public signup/email implementation is ready.

## Initial migration (after credentials are pasted)

Run `npm run db:migrate`, or ask the coding agent to run it after pasting privately.
It checks runtime and direct connectivity with SELECT 1, then requires public to
contain no tables. Any existing table, including migration history, causes a stop
before migration. It applies only the committed PostgreSQL initial migration;
it never seeds, resets, drops existing tables, or imports SQLite data.
The SQL is transactional and enables RLS on application tables to deny anonymous
Supabase Data API access. The server's Prisma connection must use the Supabase
Prisma panel's database role with permission to access these tables.
Do not run another schema writer concurrently with initialization.

This command is deliberately for first initialization only: a second run stops
because tables exist. Future incremental migrations require separate review.
A failed connectivity check hides raw diagnostics to avoid exposing connection
strings. Inspect credentials and network privately; direct IPv6 connectivity may
require a Supabase session-pooler migration connection on IPv4 networks.

## Preserved SQLite

`prisma/dev.db` remains in its original location, unchanged and ignored.
`prisma/sqlite/schema.prisma` and `prisma/sqlite/migrations/` preserve the old
provider and history. The archived schema uses `SQLITE_DATABASE_URL` so it cannot
accidentally use hosted credentials; the existing database can be addressed with
`SQLITE_DATABASE_URL=file:../dev.db` relative to the archived schema.
Original local operator scripts are archived as text under
`prisma/sqlite/legacy-scripts/`. Their old entrypoints now stop with an explanation
instead of running seeds, reset, or inbox against the active PostgreSQL client.
The archived client has a separate output location if local SQLite tooling is
restored later. No data is copied to Supabase automatically.

SQLite migration smoke tests still run against an in-memory SQLite database.
The existing outbox integration test is explicitly skipped until an isolated
PostgreSQL test database is configured. Old browser suites depend on SQLite demo
accounts and are not suitable for the hosted database. Never run those tests on
production.

## Exact Vercel environment variables

Add these under Project → Settings → Environment Variables for **Production**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Supabase's pooled Prisma DATABASE_URL |
| `DIRECT_URL` | Supabase's Prisma DIRECT_URL |
| `BETTER_AUTH_URL` | `https://mehlivo.vercel.app` |
| `BETTER_AUTH_SECRET` | Copy the generated secret privately from `.env.local` |
| `AUTH_TESTER_MODE` | `true` |
| `AUTH_TESTER_EMAILS` | `tester@mehlivo.test` |

No Supabase anon key, service-role key, or email provider is required for this mode.
Keep local BETTER_AUTH_URL as http://localhost:3000 for local browser testing.
Do not enable the production database on preview deployments by default; use an
isolated database and matching auth origin if previews need persistent data.

After the initial migration succeeds:

1. Commit and push code/schema/migrations only; never add ignored env or DB files.
2. Add the six variables above in the Vercel project.
3. Use build command `npm run build` (generates Prisma Client then builds Next.js).
   Migrations and seeds must not run in Vercel builds.
4. In Deployments, redeploy the production deployment with the new environment
   variables, or deploy the pushed commit. Environment changes require redeployment.
5. Open https://mehlivo.vercel.app and sign up with an allowlisted address and a
   password of at least 10 characters. Check login/logout and event creation.
   An unlisted address should be refused. No verification email is needed.
