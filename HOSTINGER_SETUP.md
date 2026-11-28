# Hostinger deployment and email setup

This repository supports Hostinger Apache/LiteSpeed static hosting. The dashboard currently uses Supabase for authentication, PostgreSQL/RLS, private policy storage and Edge Functions. Uploading the frontend does **not** migrate those services or their private data.

## Prepare the public website

1. Run `npm run build`, then `node package-hostinger.mjs` with a new/empty `release/hostinger/public_html` output folder.
2. Back up the target Hostinger site's existing `public_html` before uploading. Upload only the contents of the prepared `public_html`, including `.htaccess`. Never upload the repository root, `.env`, Supabase service keys or mailbox passwords.
3. The package maps `/admin`, `/partner` and `/api/config` without a Node server. It contains local PDF/OCR assets and the existing public Supabase project configuration. Preview source transport pages are excluded.
4. Verify HTTPS, both login paths, config JSON, uploads and private account isolation on the actual domain.
5. Add that exact HTTPS domain's `/admin` and `/partner` redirect paths in Supabase Auth URL Configuration. Use the chosen canonical site as Site URL.
6. Update the `admin-partners` Edge Function's explicit origin and invitation redirect to the confirmed Hostinger domain (or an exact allowlist supporting both deployments). Do not accept arbitrary browser-provided redirect origins.

## Hostinger mailbox for Supabase authentication email

Read the mailbox's **actual SMTP configuration** in hPanel and confirm the active sender address and sending limits. Enter its server, port, username and existing password in Supabase Auth → Email → SMTP settings. Mailbox passwords belong only in the service's secure settings. A mailbox password change must be completed by the owner.

Verify SPF/DKIM and sender delivery before enabling OTP. In Supabase's Magic Link template include `{{ .Token }}` as the visible one-time sign-in code; retain `{{ .ConfirmationURL }}` if email-link fallback is desired. Do not disable signup restrictions, CAPTCHA/rate limits or email confirmation.

After a real delivery test to the owner's email, set `emailOtpEnabled: true` in the hosting package's `api/config.json` (Vercel equivalent: `EMAIL_OTP_ENABLED=true`). The existing-user OTP flow uses `shouldCreateUser:false`, verifies the code with Supabase Auth and preserves role checks. It never exposes a public signup option. Codes and SMTP secrets are not stored in the frontend.

## Moving every backend service to Hostinger

First confirm the plan supports the required server, PostgreSQL, background jobs, private file access, SMTP and backups. A shared website directory alone cannot run the existing Supabase RLS/Auth/Edge Functions. Plan and verify a separate backend migration, including users/password compatibility, row policies, documents, earnings ledger, invitations and Google Forms receiver, before cutover. Keep the current backend active until reconciliation passes. No private data has been migrated by this package.
