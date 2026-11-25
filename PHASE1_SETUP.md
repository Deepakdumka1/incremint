# Phase 1 — live policy approval and partner credits

The implementation uses Supabase Auth, PostgreSQL row-level security and private Supabase Storage. It does not reuse the original Incremint account or its backend.

## Implemented flow

Admin entry: `https://incremint-sigma.vercel.app/admin#admin-policies`

Partner entry: `https://incremint-sigma.vercel.app/partner#mypolicies`

These entries use separate authentication storage keys, so two different accounts can stay signed in side by side. Legacy `/#admin...` links redirect to `/admin`; other legacy entries redirect to `/partner`, retaining the existing partner session. A role mismatch shows an access message instead of silently rendering the other dashboard. Sign-out affects only the current session. Email sign-in links are also supported; they verify the email and return to the workspace that requested the link. Admin rights still come only from the trusted database role.

1. A partner signs up with a name, email and password, confirms their email, then signs in.
2. The partner uploads a PDF/JPG/PNG/WebP policy, customer details and optional insurer/policy/premium/date details.
3. The private document is uploaded first. Only then does the policy enter the admin’s **Pending** queue. Interrupted uploads remain recoverable under **Upload incomplete**.
4. The admin sees the submitting partner’s name and email, customer details, policy metadata and a short-lived private download link.
5. The admin approves or rejects the policy. Rejection needs a reason, which the partner can see.
6. For an approved policy, the admin enters points and/or an earning amount, reviews the recipient and values, then confirms the credit.
7. A single immutable ledger entry updates the partner’s policy list, dashboard and wallet. Database transactions and a unique policy constraint prevent duplicate credits. Realtime events refresh both views, with a 20-second polling fallback.

Credits represent points and earning balances in this application. This phase does not execute bank payouts or withdrawals.

## Go live

The Sigma0Nine production project has now been created and its initial SQL migration applied. Its browser-safe URL and publishable key are in `config/public-project.mjs`; no secret key is needed by this app. Environment variables remain supported as a complete override for other deployments. If any Supabase environment variable is provided, both the URL and public key must be valid; the app will not silently mix projects.

### 1. Create your own Supabase project

Use a dedicated project named **Sigma0Nine**. A shared database and private object storage are required; browser storage cannot sync different users/devices. The project owner completes provider sign-in, account terms and any billing choices.

### 2. Apply the migration

In Supabase → SQL Editor, run the complete file:

`supabase/migrations/202611240001_phase1.sql`

Run this initial migration once, in the new project. It creates `sigma_profiles`, `sigma_policies`, `sigma_ledger`, `sigma_audit`, the private `sigma-policies` bucket, access policies and the review/credit transaction functions. Do not replace private policies with public access.

### 3. Configure authentication

Enable email/password sign-in. Keep email confirmation enabled and use a strong minimum password length (the app requires 12 characters for signup/password resets). Configure:

- Site URL: `https://incremint-sigma.vercel.app`
- Allowed redirect: `https://incremint-sigma.vercel.app/**`
- Local development redirect, if needed: `http://127.0.0.1:4173/**`

Configure your production email provider if Supabase’s default email limits are insufficient. Account confirmation and password-reset delivery depend on this provider configuration.

### 4. Connect Vercel

In the existing `incremint` Vercel project, add these **Production** environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The legacy anon key is supported as `SUPABASE_ANON_KEY` instead of `SUPABASE_PUBLISHABLE_KEY`. **Do not use a service-role or secret key.** `/api/config` exposes only a public/publishable key and refuses known secret/service-role formats. The database access policies enforce permissions.

Redeploy after setting the environment variables. The app switches to the authenticated Phase 1 portal when configuration is present. Until then, existing browser tools remain available and `/#policyportal` clearly shows the connection is pending.

### 5. Provision the first admin

Sign up the intended admin through the app and confirm that email. Then, as the project owner in SQL Editor, replace the placeholder and run:

```sql
update public.sigma_profiles
set role = 'admin'
where lower(email) = lower('YOUR_ADMIN_EMAIL')
returning id, full_name, email, role;
```

Verify that exactly the intended account was returned. Sign out and sign in again. Normal signup always creates a **partner**; client metadata cannot assign an admin role. Further admins must be provisioned through this same trusted owner process.

## Local development

```text
npm ci
npm run build
npm start
```

Use an ignored `.env` file based on `.env.example` to connect a development project. Never commit credentials. The dev server supports `/api/config` and serves the same client bundle as Vercel.

## Validation

```text
npm test
```

Tests run the actual SQL migration in embedded PostgreSQL (PGlite), with mocked Supabase `auth` and `storage` schemas. They cover owner isolation, private storage policies, denied anonymous access, forbidden client role elevation, document-before-submission, approval restrictions, rejected-policy credits, immutable ledger entries, duplicate-credit prevention, exact paise arithmetic, retries reusing the same upload ID, public-config key filtering and partner/admin UI boundaries.

These tests do not substitute for Supabase’s hosted Auth/Storage integrations. After connecting the real project, complete this acceptance test with two separate accounts/sessions:

1. Partner signs up, confirms email and uploads a synthetic test policy.
2. Admin sees the partner’s identity and file, then approves it.
3. Admin credits test points and an earning amount, confirming the review screen.
4. Partner sees the approved policy and exact credits in their list and wallet without a manual data copy.
5. A repeated credit attempt fails, and a second partner cannot see the first partner’s records or documents.

## Phase boundaries

- No AI extraction, automated insurer issuance, bank transfer or withdrawal is implied.
- Approved and rejected submissions are immutable to partners. A corrected policy can be uploaded as a new submission.
- Credits cannot be edited or deleted through the application. Reversals/adjustments and withdrawals require a separately designed audited ledger flow.
- The live portal uses shared database records. It never imports browser-demo records or a local admin role into the live account.
