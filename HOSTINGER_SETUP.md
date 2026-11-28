# Hostinger deployment and email setup

## Admin isolation and profiles — 28 November 2026

- Applied migrations 007 and 008 through the owner SQL editor. The first migration's initial attempt hit a concurrent deadlock and rolled back; the retry completed successfully. No policies, earnings or partner accounts were deleted.
- Published versioned portal/core/workspace/CSS assets and the new portal-profile.js to Hostinger. The API config and email sender were preserved.
- Live authenticated-role checks: original administrator sees 7 partners and 4 policies; Rohit's account sees 0 partners, 0 policies and a zero summary. Local two-admin tests verify allowed own-workspace operations and denial of cross-workspace reads/uploads/reviews/credits/payments/form assignments.
- Verified live profile editor, local photo preview, and saving unchanged personal details. No sample photo was saved to a real profile.
- A separate browser tab opened its own sign-in form while the original admin remained signed in. Rohit's supplied password returned Invalid login credentials, so a successful second-account browser login was not claimed and no password was changed.
- Final build and all 78 tests passed. New Google Form integrations for additional administrators are not provisioned automatically; the existing four forms remain with their original owner.

## Deployment record — 28 November 2026

- Uploaded the tested static build to `sigma0nine.in` → `public_html`, including `.htaccess` and local PDF/OCR assets. Moved the uploaded ZIP outside `public_html`; retained Hostinger's original `default.php`.
- Verified the partner sign-in page and an authenticated administrator's real policy list at `https://first-mediumpurple-kangaroo-62.hostingersite.com`. Public signup remains closed.
- Added exact `/admin`, `/partner` and `/partner?invite=1` Auth redirect URLs for the temporary host, `sigma0nine.in` and `www.sigma0nine.in`. The prior Vercel redirect remains available during cutover.
- Deployed the updated `admin-partners` function with the four exact trusted HTTPS origins; legacy JWT verification remains enabled.
- SMTP settings were saved through the owner's Supabase UI with Hostinger's SMTP host and port 465. No password was copied into this repository. Saved the `sign-in.html` template from `integrations/email`, enabled `emailOtpEnabled` in the deployed Hostinger config, and successfully requested a sign-in code for the owner's existing verified email. Inbox receipt/code verification is still to be confirmed.
- The domain still needs its GoDaddy DNS connected. Hostinger reports `A @ → 145.79.211.35` and `CNAME www → sigma0nine.in`, TTL 300. This preserves the current DNS provider. No domain records were changed or nameservers marked complete. HTTPS on the main domain failed while DNS/SSL setup was incomplete; no certificate warning was bypassed.
- Hostinger offers MySQL for this site; no database exists there yet. **Private policy files, users, earnings and Google Form enquiries still use Supabase.** A backend/data migration has not been performed.

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

### Email activation verification

The invitation email template now includes both its secure activation link and `{{ .Token }}`. The deployed admin's **Check invitation service** returned “Admin invitation service connected” on the Hostinger temporary domain. The sign-in code request returned success and opened the code-entry form for `ddumka102@gmail.com`; inbox receipt and code verification remain outstanding. Hostinger's outgoing email log had not populated when checked. The active mailbox plan shown in hPanel is a free trial ending 28 December 2026.

## Document autofill update — 28 November 2026

- Deployed updated policy-fields.js, policy-autofill.js, portal.js, portal.css, index.html and vendor/policy-reader.mjs directly through Hostinger File Manager. Existing API configuration was preserved.
- Checked all six owner-provided PDFs locally in the actual browser upload form: all seven non-mobile policy fields filled. All six customer mobiles were masked and remained blank. Synthetic PDF verified complete-mobile autofill and editing.
- Live Hostinger admin upload form extracted all eight fields from a synthetic PDF. Canceled without submitting a policy. Build and all 69 tests passed. Real customer files and extracted text remain outside version control.

## Partner contact fields — 28 November 2026

Applied 202611280006_partner_contact.sql, deployed admin-partners with validated optional phone/address invitation metadata, and uploaded portal-admin.js plus the versioned index.html to Hostinger. Verified the live Create partner account form and Phone/Address columns. Existing accounts retain blank contact values. Build and 27 relevant endpoint/database/UI tests passed; no test invitations were emailed.

