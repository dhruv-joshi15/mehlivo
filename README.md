# Mehlivo — celebrations, together

A responsive browser website built with Next.js, TypeScript, Better Auth, Prisma and a real local SQLite database. No paid services, external credentials, email delivery, payment screens or deployment are involved.

## Install and start

Node.js 22.22.2 was used. From this folder:

```sh
npm install
npm run setup
npm run db:seed
npm run dev
```

Open **http://localhost:3000**. `setup` creates `.env` with a random authentication secret, generates Prisma Client and applies committed migrations. `.env.example` documents settings without secrets. Do not put `.env` or SQLite files in version control. Run on port 3000; if changing it, update `BETTER_AUTH_URL` in `.env`, restart the server, and use that same origin in your browser.

Publishing an event enables its local guest invitation; it does not deploy a website. Localhost links work in another browser or incognito on this computer. Another phone cannot open a localhost URL: you must deliberately configure LAN access, a suitable authentication origin and firewall access, or later host the website. Clipboard buttons require a secure browser context; a selectable link is provided on clipboard failure.

## Test accounts

Development only, both use password **`MehlivoLocal!2026`**:

- `host@mehlivo.test`: Aarav & Ira’s wedding, with Mehndi and Wedding functions, catering, optional dress code and attending / declined / unsure / pending households.
- `other@mehlivo.test`: Raj’s party, owned separately.

You can also sign up with an email address you control. Verification messages are previewed locally. Email verification is available but is not required to log in during this iteration.

## Manual testing guide

1. Run the install/start commands above and open http://localhost:3000. Check the visible “Local test environment” banner.
2. Log in as `host@mehlivo.test`. Open the sample wedding. Check the attendance, invited households, planning target and pending invitations. Log out and back in to check sessions.
3. Choose **Create event**. Move through The occasion → When and where → Preview and publish. Back/Continue preserves entries. Add optional wedding presets, duplicate functions or copy the main venue. Optional planning settings are in the final step. Drafts are saved explicitly, after the required fields are valid; there is no background autosave. The event timezone applies to function inputs and the RSVP deadline.
4. Open its dashboard and choose **Add household invitation**. Select functions, a household name and a maximum number of people. Copy the resulting private link immediately. Its raw token is not retrievable later; use Replace private link if needed. Invitations from the seed deliberately do not print private tokens; create a new invitation to test a private link. Use the general invitation link for an open household response.
5. Open either invitation in incognito. No guest account is required. A private link shows only its invited functions. Check the schedule, map, optional theme and RSVP deadline. A general public invitation never exposes guests or catering data.
6. Submit a household response. For each attending function, add everyone attending, including yourself, and select members’ functions. Counts derive from those entries. Try exceeding a private invitation’s limit. Decline all functions or choose unsure without entering members. After saving, inspect the summary, copy the private response-management link, and choose **Update my response**. Refresh and reopen that same link: the existing household is updated. Anyone possessing the link can manage that response; keep it private. A general link also remembers the management link in that browser for convenience.
7. Return to the host dashboard. Wait up to 15 seconds or press **Refresh**. Search by household/member name, filter by function/status and check pending households. Select **View / edit** to correct a response; choose **Confirmed by phone** when appropriate. Try a past deadline: guest edits are blocked while host corrections still work. Check adult/child totals and catering calculations. Example: 3 adults at ₹100 + 1 child at ₹50 + ₹12.34 fixed = ₹362.34 confirmed; a 10% buffer yields 4 adults + 2 children = ₹512.34. Blank child price uses the adult rate. Pending, unsure and declined people never count as confirmed.
8. Download **CSV** and **Excel workbook**. Excel contains Guest list, Attendance totals and Catering sheets, with human-readable rupee price columns, currency formatting and formulas. Downloads are snapshots; they do not keep updating. User text beginning with spreadsheet formula characters is escaped.
9. Open **Development inbox**. All messages are labeled “Development preview — not delivered”. Only messages for the signed-in account appear. Check account verification and guest RSVP notifications, including meaningful changes. Repeated saves with no change do not create notifications; host edits do not notify the host. To test password reset, log out and use **Forgot password?**. Since the inbox itself requires login, inspect the reset link from the local terminal:

   ```sh
   npm run inbox -- host@mehlivo.test
   ```

   Open the latest reset link, set a new password, confirm the old password fails and log in with the new one. The command is a local development operator tool and can inspect messages for the specified email; never share its private reset/verification URLs. Pending outbox messages retry when the inbox is refreshed or this command runs.

10. Copy the first host’s dashboard URL. Log out and sign in as `other@mehlivo.test`, then open that URL. The event must not load. Its API, household edits and exports return not-found. A fabricated guest token must fail. Unpublish an event to close its public/private guest access. Delete a throwaway event by typing its exact title into the confirmation form.

## Checks

With the development server running on port 3000:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit
```

If Chromium is not already installed, run `npx playwright install chromium` before browser tests. Tests create real temporary database accounts and events, then remove their own records. The test suite targets localhost:3000; it must not target production. Unit tests cover catering rounding, child-rate fallback, export formula escaping and public DTO privacy. Integration/browser tests cover signup, verification, login/logout/reset, event drafts/publishing, multiple functions and themes, private scope and limits, guest RSVP and updates, idempotency, conflicts, deadlines, host corrections, dashboard metrics, notification deduplication, CSV/Excel and responsive forms. See [verification notes](docs/VERIFICATION.md) for the results from this build.

`npm run build` checks the production build. To test it separately, stop the development server first, then run `npm start`. With the local production server running and the sample accounts seeded, run `npm run test:e2e -- --config=playwright.production.config.ts` to verify production guards. Production mode disables the local banner, development inbox API, seed, reset and inbox commands. The email provider intentionally does not deliver in production; this is a local MVP and needs a production provider before hosting.

## Reset test data

This deletes **all local accounts, sessions, events, households, responses, verification records and test messages**, then recreates sample data:

```sh
npm run db:reset -- --confirm-local-reset
```

It only accepts `DATABASE_URL="file:./dev.db"` outside production and requires the explicit flag. Stop the server first and restart it afterward. Copy `prisma/dev.db` to a safe location first if you want a backup. `npm run db:seed` alone is non-destructive: it skips sample event creation when the first sample host already has an event.

## Architecture and security

- Next.js route handlers enforce host ownership on all event, response and export operations. Better Auth handles local password hashing, cookie sessions, reset/verification tokens, session revocation and auth rate limits. The host UI redirects logged-out visitors; the API is the authorization boundary.
- Prisma models include users/accounts/sessions, events, functions, households, invitation scope, members, attendance, hashed private tokens, history, notification preferences, durable email outbox, development messages and rate-limit windows. Foreign keys cascade on event deletion; indexes cover ownership, token lookup and response queries. Committed migrations initialize SQLite.
- Guest capabilities use 256-bit bearer tokens stored as SHA-256 hashes. General-response tokens derive through HMAC-SHA-256 from a random submission UUID and the server secret, so a lost response to a retried submission returns the same link. Preserve the server secret. Names, emails and phones do not authorize edits. Tokens are never intentionally logged. Response pages use a no-referrer policy and no external assets or analytics.
- Shared Zod schemas validate submissions server-side. HTTP(S)-only map URLs, bounded text/numbers, explicit function scope, capacity enforcement, member-derived counts and server-side deadlines protect core invariants. Public responses omit budgets and guest lists. Same-origin checks cover application writes; Better Auth handles auth request origins. Public RSVP writes use a database-backed per-event/per-household limit of 30 per minute.
- RSVP writes, history and notification enqueue occur in one transaction. Delivery happens afterward and failures leave a pending outbox without losing the response. Notification keys are unique per history entry; preview creation is idempotent. Event and household version checks reject stale edits with HTTP 409; identical retries are no-ops. A submission UUID is unique to avoid duplicate new households from double clicks/retries.
- `src/lib/mail.ts` defines the provider interface. Only the development provider exists. The preview page is both account-scoped and hard-disabled in production. Production delivery is intentionally unavailable.
- Monetary values are integer minor units. Buffers round additional adults and children up independently and fixed charges are added once. Estimates are not guaranteed bills or savings.

## Current limitations

- Local MVP, not a production deployment. SQLite and simple polling suit local testing; distributed rate limiting, scheduled outbox workers, monitoring/backups, privacy retention controls and a real email provider need production work.
- Household private links are bearer capabilities. Raw private invitation links are shown only when created; keep a copy. Use Guests → Replace private link to invalidate the old link and issue a new capability for the same household. A new general invitation submission intentionally creates a new household; guests must use their private management link to update an existing one.
- Function removal is blocked once households exist, preserving invitation scope/history. A newly added function is visible through the general event link but is not automatically added to existing private household invitations. There is no invitation-scope editing UI yet; decide your function schedule before creating private invitations.
- Every attending function requires at least one selected member. Unsure/declining functions store household status without claiming any confirmed people. Whole-number buffers from 0–100% are supported. Event start times use one shared event timezone; ambiguous/nonexistent daylight-saving times should be checked when using timezones outside Asia/Kolkata.
- The development inbox is capped at the latest 100 messages per account. Auth endpoint rate limits are process-local; RSVP limits use SQLite. Outbox retry is driven by inbox refresh/CLI, rather than a background worker.
- No uploads, advanced invitation design, automated WhatsApp/Instagram delivery, Google Sheets integration, payments, AI or native app features.

## Later: hosted PostgreSQL

Keep the relational models and service boundaries. Back up/export SQLite, change Prisma’s datasource provider to `postgresql` and use a server-only hosted database URL. Create a new PostgreSQL migration baseline (SQLite migration SQL is not portable), transform/import data with preserved IDs and relationships, compare row counts and attendance/budget totals, and test constraints, transactions and ownership against PostgreSQL before switching. Configure a supported Prisma connection pool, stable HTTPS auth origin/secrets and production email provider. Do not run local seeds/reset against hosted data. Review currency ranges and distributed rate limiting as scale grows.

## Later: payments (not implemented)

Future one-time host payments: Wedding Essential ₹1,200; other-event Essential ₹800. Signature/Luxury tiers remain unspecified. Guests always respond free. `Event.paymentStatus` currently records `LOCAL_FREE` and is not a payment verification flag.

Use official Razorpay hosted checkout with supported UPI Intent/QR options, server-created orders, server-side verification and idempotent authenticated webhooks. Activate paid features only after verified provider confirmation. Start in official Razorpay test mode without real money and never request a real UPI transfer during testing. Document UPI app behaviours that test mode cannot reproduce. All simulators and activation bypasses must be unavailable in production. No checkout or mock payment screens exist in this build.

## References

Authentication integration follows the [official Better Auth Next.js documentation](https://better-auth.com/docs/integrations/next) and the [Prisma Better Auth guide](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs), adapted to local SQLite and the installed package versions.


## Celebration redesign

The shared design uses midnight plum, soft lilac, apricot and porcelain, serif display headings with system fallbacks, quiet form surfaces, original SVG motifs and reduced-motion-aware interactions. The homepage’s `/demo` invitation is clearly labelled and never stores a response.

The host dashboard has Overview, Guests, Invitation, Budget and Settings sections. Published events prioritise sharing; drafts link to setup. General-link visitors do not produce invented pending counts. Guest targets of zero display as Not set. Guests move through attendance, household members, and review; declining every function skips members. Counts, deadlines, scope, capacity and conflict checks remain server enforced.

Private-link replacement requires the owning host. It deletes all previous private capabilities for that household and creates a new secure token in one transaction, preserving members, attendance and history. Copy/share the new link immediately. Ordinary sharing never rotates it. Editable invitation messages support clipboard and normal WhatsApp sharing.

Excel catering prices and cached formula results are exported in currency units (INR rupees), with currency number formats. Internal calculations remain integer paise. Guest CSV injection protection remains enabled.

For an existing local install, start with `npm run dev` and open http://localhost:3000. Do not seed or reset to try the redesign. No schema migration is required for these changes.

See [prioritised future work](docs/BACKLOG.md) and [verification details](docs/VERIFICATION.md). Local email preview, SQLite and manual draft saving remain intentional limitations. Browser-stored unsaved entries are not restored after a reload or leaving the editor.

## GitHub and Vercel

Import `dhruv-joshi15/mehlivo` in Vercel with the Next.js preset. The build command generates the Prisma client before building Next.js. The public homepage and `/demo` preview need no seeded data.

The current backend uses a local SQLite file: it cannot persist event data on Vercel's serverless filesystem. Before enabling real accounts or invitations there, migrate to a hosted database using the PostgreSQL notes above (including the Prisma schema, migration baseline and Better Auth adapter provider), set `DATABASE_URL`, `BETTER_AUTH_URL` to your HTTPS deployment origin, and a strong `BETTER_AUTH_SECRET`. Apply migrations to that hosted database separately. Real email delivery also requires a production provider; the included provider only previews mail locally. Do not upload `.env`, SQLite data, or demo credentials to GitHub or seed production with local test data.
