# Sigma0Nine Partner Studio

A responsive insurance partner dashboard branded with the supplied Sigma0Nine logo, navy and electric blue. Includes a welcome banner, performance chart, monthly milestone ring, product shortcuts and an assistant entry point. Existing browser records retain their original storage keys for continuity.

**Phase 1 policy portal:** real email/password authentication, private policy uploads, admin approve/reject, one-time points/earning credits and a partner wallet are implemented against Supabase. Read [PHASE1_SETUP.md](PHASE1_SETUP.md) to provision the new database, connect Vercel and assign the first admin. Until that connection is configured, `/#policyportal` shows setup pending and the existing workspace remains available.

Run `npm ci`, `npm run build`, then `npm start` and open http://127.0.0.1:4173.

Run `npm test` for functional, SQL security, credit-ledger and portal checks.

Vercel deploys the static files in `dist/`, as configured in `vercel.json`. Import the repository with the repository root as Root Directory. Git pushes to `main` trigger a new production deployment when the Vercel Git integration is enabled.

Includes dedicated product lead workflows, draft persistence, locally stored documents, pending policy requests, six-stage lead pipeline, contacts and prospects, renewal filters, imported payout statements, rate comparisons and earnings calculations, Health/Niva quote documents, CSV/XLSX exports, printable reports, licensed media personalisation, advisor-page HTML export, profile settings and backup/restore.

New browser workspaces start empty. Existing browser data is preserved. Records use localStorage; files use IndexedDB on the same device. JSON backups include records and file references, not the binary uploaded documents. Export important documents separately.

This is **not an exact production clone**. Authentication, a shared database, AI extraction, team approval, official insurer quotes, commission settlement, WhatsApp automation, billing, cloud media rendering and tracked referrals require independent backend services and credentials. Service screens state their connection limits. No original Incremint private records or confidential rates are bundled.

Read [FEATURE_PARITY.md](FEATURE_PARITY.md) for the signed-in reference audit, implemented workflows, provisional fields, unverified behavior and remaining service dependencies.

Typography uses Google Fonts with system sans-serif fallbacks. All interface graphics are inline SVG.
