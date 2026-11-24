# Sigma0Nine Partner Studio

A responsive insurance partner dashboard branded with the supplied Sigma0Nine logo, navy and electric blue. Includes a welcome banner, performance chart, monthly milestone ring, product shortcuts and an assistant entry point. Existing browser records retain their original storage keys for continuity.

**Phase 1 policy portal:** real email/password authentication, private policy uploads, admin approve/reject, one-time points/earning credits and a partner wallet are connected to the dedicated Sigma0Nine Supabase project. The SQL migration and production login redirects have been applied. The first admin still needs a confirmed account and an owner-assigned role. Read [PHASE1_SETUP.md](PHASE1_SETUP.md) for setup and acceptance checks.

Run `npm ci`, `npm run build`, then `npm start` and open http://127.0.0.1:4173.

Run `npm test` for functional, SQL security, credit-ledger and portal checks.

Vercel deploys the static files in `dist/`, as configured in `vercel.json`. Import the repository with the repository root as Root Directory. Git pushes to `main` trigger a new production deployment when the Vercel Git integration is enabled.

Includes dedicated product lead workflows, draft persistence, locally stored documents, pending policy requests, six-stage lead pipeline, contacts and prospects, renewal filters, imported payout statements, rate comparisons and earnings calculations, Health/Niva quote documents, CSV/XLSX exports, printable reports, licensed media personalisation, advisor-page HTML export, profile settings and backup/restore.

The earlier browser workspace uses localStorage and IndexedDB. The authenticated Phase 1 portal uses shared Supabase records and private Storage instead; it never imports browser-local roles, demo credits or files into live accounts.

This is **not an exact production clone**. Phase 1 supplies its own authentication, shared database and team policy approval. AI extraction, official insurer quotes, bank settlement, WhatsApp automation, billing, cloud media rendering and tracked referrals remain outside this live phase. No original Incremint private records or confidential rates are bundled.

Read [FEATURE_PARITY.md](FEATURE_PARITY.md) for the signed-in reference audit, implemented workflows, provisional fields, unverified behavior and remaining service dependencies.

Typography uses Google Fonts with system sans-serif fallbacks. All interface graphics are inline SVG.
