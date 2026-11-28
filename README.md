# Sigma0Nine Partner Studio

A responsive insurance partner dashboard branded with the supplied Sigma0Nine logo, navy and electric blue. Includes a welcome banner, performance chart, monthly milestone ring, product shortcuts and an assistant entry point. Existing browser records retain their original storage keys for continuity.

**Current operations:** invitation-only partner onboarding, amount-only earning awards and UTR/private payment receipts are implemented. Public self-registration is disabled. See [PHASE2_SETUP.md](PHASE2_SETUP.md) for deployment state and the pending SMTP sender requirement. The partner navigation now uses Brochures, omits quote/network menus and hides My leads. Mutual Funds and the ICICI/Go Digit/Tata quote cards are removed from Refer & Earn.

**Phase 1 policy portal:** real email/password authentication, private policy uploads, admin approve/reject, one-time points/earning credits and a partner wallet are connected to the dedicated Sigma0Nine Supabase project. The SQL migration and production login redirects have been applied. The first admin still needs a confirmed account and an owner-assigned role. Read [PHASE1_SETUP.md](PHASE1_SETUP.md) for setup and acceptance checks.

Run `npm ci`, `npm run build`, then `npm start` and open http://127.0.0.1:4173.

Run `npm test` for functional, SQL security, credit-ledger and portal checks.

Policy uploads include free browser-local document autofill: PDF.js reads native text first; Tesseract reads English scanned PDFs/photos when needed. It fills customer name, complete customer mobile, policy number, insurer, product, final payable premium and policy dates when identifiable. Masked numbers and agent/nominee contacts stay blank; mobile remains editable. Table columns, bilingual labels, welcome-letter addressees, split dates and diagonal watermarks are handled. Tax-inclusive final totals take priority over base/gross premiums. Only required fields appear in the main form; optional policy details can be expanded for review/editing and are saved with the submission. Existing manual entries are preserved, conflicting values remain blank, and suggested values require review before submission. Reading is limited to the first 24 PDF pages and up to 4 scanned pages; manual entry remains available. Runtime assets and the English OCR model are served by this website, with no paid extraction API. Only the normal reviewed upload sends the document and entered fields to private Supabase storage/database. Standard hosting/storage quotas still apply.

The authenticated partner sidebar now includes the full business workspace: dashboard, Refer & Earn, marketing, assistant preferences/draft previews, bookings, statement, renewals, rates, leads, network, prospects, contacts, quote tools, help and settings. Business records/drafts use `sigma_workspaces` with owner-only access and optimistic concurrency; associated files use private `sigma-workspace-files`. Policy status and earned points remain exclusively in the reviewed policy/immutable ledger tables, never in editable workspace JSON.

Refer & Earn mirrors the reference catalogue flow with 12 categories, internal product detail pages, insurer quote resources, demat and support/resource destinations. All external URLs start empty and are supplied by the client through **Admin → Manage referral links**. Pending links are visibly inactive. No original agent tokens, credentials or referral codes are copied. Admins get a dedicated **Give points / earnings** queue, direct approved-row credit buttons, and the credit form opens after approval without automatically issuing a credit.

Vercel deploys the static files in `dist/`, as configured in `vercel.json`. Import the repository with the repository root as Root Directory. Git pushes to `main` trigger a new production deployment when the Vercel Git integration is enabled.

Includes dedicated product lead workflows, draft persistence, locally stored documents, pending policy requests, six-stage lead pipeline, contacts and prospects, renewal filters, imported payout statements, rate comparisons and earnings calculations, Health/Niva quote documents, CSV/XLSX exports, printable reports, licensed media personalisation, advisor-page HTML export, profile settings and backup/restore.

The earlier browser workspace uses localStorage and IndexedDB. The authenticated Phase 1 portal uses shared Supabase records and private Storage instead; it never imports browser-local roles, demo credits or files into live accounts.

This is **not an exact production clone**. Phase 1 supplies its own authentication, shared database and team policy approval. AI extraction, official insurer quotes, bank settlement, WhatsApp automation, billing, cloud media rendering and tracked referrals remain outside this live phase. No original Incremint private records or confidential rates are bundled.

Read [FEATURE_PARITY.md](FEATURE_PARITY.md) for the signed-in reference audit, implemented workflows, provisional fields, unverified behavior and remaining service dependencies.

Typography uses Google Fonts with system sans-serif fallbacks. All interface graphics are inline SVG.
