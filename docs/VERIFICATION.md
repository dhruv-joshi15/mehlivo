# Verification — 27 October 2026

Validated locally on Node.js 22.22.2 with real SQLite records. No external emails were delivered and nothing was deployed.

| Check | Result |
| --- | --- |
| `npm run setup` | Passed: client generation and committed migrations; repeated setup had no pending migrations |
| `npm run db:seed` / development seed runner | Passed: two hosts, wedding with two functions, party, attending / declined / unsure / pending households |
| TypeScript / production build | Passed |
| `npm test` | 8 passed: catering buffer/child-rate rules, spreadsheet injection defense, public data privacy, map URL validation, fresh SQLite migrations, production CLI guards, email failure and outbox retry/deduplication |
| `npm run test:e2e` | 11 passed against the development server with real SQLite and Chromium |
| Final guest-summary browser check | Passed: signup → draft → publish → private invitation → guest RSVP → member update → host phone correction → inbox → logout/login |
| Production guard suite | 1 passed against `npm start`: authenticated development inbox returns 404, local flag is false, local-test banner absent |
| `npm audit` | 0 vulnerabilities |
| Desktop/mobile inspection | Passed: readable dashboard and invitation at desktop and 390px width; tables scroll within their container |

The browser/API suite covers signup/verification/login/logout/reset, reset session revocation, single and multiple functions, theme visibility, publishing, guest responses and edits, invitation capacity/scope, deadline protection, host corrections, derived totals, pending invitations, catering, CSV/Excel contents and formulas, notification deduplication, ownership protection, response capabilities, stale-edit conflicts, retry idempotency and confirmed event deletion. A request containing another household ID is scoped to its own bearer token.

The outbox failure test deliberately replaces only the development delivery function with a throwing provider. It uses real database writes and confirms the RSVP is committed, the outbox remains pending, retry creates one preview, and identical RSVP retries do not enqueue duplicates. No API responses are mocked.

The fresh-migration check creates an isolated temporary SQLite file, applies the committed migration, verifies tables, and removes that temporary database. Production CLI tests verify seed/reset/inbox refuse to run with `NODE_ENV=production`; they do not reset the main database. The destructive default-database reset was not executed against the main sample data.

Temporary flow-test accounts/events were removed. The two sample hosts and two sample events remain. Preview servers were stopped after testing; use `npm run dev` to begin testing.

Current limits and the full ten-step manual guide are in the root README. Production email delivery, hosting, payments, PostgreSQL migration and external-device networking were not configured or tested.
