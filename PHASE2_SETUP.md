# Partner onboarding and payment receipts

Migration `supabase/migrations/202611270003_partner_payments.sql` was applied to the production Sigma0Nine project on 27 November 2026. It adds private payment proof storage, immutable payment receipts, invitation history/reservations and amount-only credit enforcement. Existing point history is retained but new points cannot be issued.

The Supabase Edge Function `admin-partners` is deployed from `supabase/functions/admin-partners/index.ts`. It validates the caller using Supabase Auth, checks the database admin role, reserves/rate-limits the email, then invokes the server-only invite API. Its service role credential stays in built-in Edge Function environment variables. It never returns credentials to the browser or allows selecting an admin role. Legacy gateway JWT verification remains enabled. The live no-email connection check succeeded with the existing administrator session; no authentication setting change was needed.

Public user signups are disabled in Supabase Authentication > Sign In / Providers. Public signup UI and `shouldCreateUser: true` sign-in behavior have been removed. Existing users remain valid. The invitation link opens `/partner?invite=1`; the signed-in invite recipient sets a password and enters the partner dashboard. A code entry screen also supports `verifyOtp` with type `invite`.

## Email delivery prerequisite

The project currently uses Supabase's default mail service. A business mailbox/SMTP sender is not yet available. Its recipient restrictions and sending limits apply; do not advertise arbitrary-recipient production invitation or OTP delivery until a sender is configured and tested. With custom SMTP, set the Invite user template to the reviewed `supabase/templates/invite.html`, which includes both `ConfirmationURL` and `Token`. Default invitation emails provide an activation link. Configure SMTP through the provider dashboard without placing credentials in source or chat.

## Admin use

- **Manage partners**: enter name/email and send an invitation. Invitation history distinguishes sending, sent (provider accepted) and failed; sent is not a delivery/verification guarantee.
- **Review policies**: approve, then award a positive rupee amount. No new point awards.
- **Earnings & payments** or policy details: record completed payment using UTR and/or private screenshot/PDF. Receipts are recorded once per earning, not bank transfers. The partner sees their own payment date, reference and private proof link.
- **Manage referral links**: configure product brochure URLs shown in the shared Brochures library. Missing client URLs remain pending.

Receipts require a prior positive earning credit. Row locks and unique ledger constraints prevent duplicates. Retry with the same receipt returns the original record. Partners cannot create receipts, change amounts, read another partner's receipt, or upload proof on the admin's behalf. Proofs are immutable after recording and use 60-second signed download links.

## Validation

49 tests passed before the final catalogue cleanup. `npm test` covers invitation authorization, fixed redirects, honest send failures, amount-only credits, receipt ownership, file metadata, retry safety, private storage, navigation removals and all prior policy autofill/security checks. Test documents and QA pages stay in ignored folders. No customer policy files or payment proof samples are committed.

## Admin-assisted policy uploads

Migration `202611270004_admin_policy_upload.sql` was applied on 27 November 2026. Admin overview and Review policies offer **Upload for partner**. The administrator searches existing partner accounts and chooses the policy owner before selecting a file. Autofill remains enabled and the selected name/email stays visible. The storage path and policy owner use the partner ID; the new `uploaded_by` field defaults to the authenticated uploader and cannot be forged by client inserts. Submission audit records retain both owner and actor. Policies still go through Pending, approval and an amount award; the earning ledger continues to use the partner owner, not the administrator uploader. Incomplete uploads can be resumed by an administrator.

Ordinary public admin and partner login screens contain no signup, account-creation or invitation-code entry buttons. Public signup remains disabled at the Auth provider. Existing invitation verification links continue to work; code verification is reachable only through a dedicated invitation URL. No admin account was created by this change.
## Insurance enquiry forms — 28 November 2026

The catalogue includes Home Insurance, Term Online/Offline, Marine and Workmen Compensation. Five client-supplied provider destinations were saved through authenticated referral settings; token-bearing provider URLs are not committed to source.

Four Google Forms were created in the owner's ddumka102@gmail.com account and published for respondents with the link. Required partner/customer contact and consent fields, plus key product requirements, were checked in the editor. Fire's published respondent view was checked for required fields. No customer responses were submitted during verification.

- Fire & Burglary: https://docs.google.com/forms/d/e/1FAIpQLSdpq2et04CACuQfeTd_a4g-IIfwCEWrJXNAFaZnLPFMzYmW_g/viewform
- Marine: https://docs.google.com/forms/d/e/1FAIpQLSdoxsXfJvpWI1McHiXN4QbQSVPzGTHI0zW5IqvvdY3prAIDbA/viewform
- Workmen Compensation: https://docs.google.com/forms/d/e/1FAIpQLSdJ4zfobsI75VUJvo_6vshrcfEHvQlmoZLGKsgeZ0OeeKwI4Q/viewform
- Term Offline: https://docs.google.com/forms/d/e/1FAIpQLSdTXy4z-0yIQIxhuqT7fZzaf2EUebgcYgoH4ZYee8K4ZxTcQA/viewform

All nine destinations were saved and their settings values matched against the supplied/published URLs. Forms use an enquiry structure based on the available reference workflow. Marine/Workmen options did not open in the signed-in reference catalogue, so exact original parity is unverified. Responses remain in Google Forms; there is no automated Forms-to-Supabase ingestion. Form edit access was not shared publicly.

### Google Forms dashboard sync

- Migration `202611280005_forms_sync.sql` adds a private enquiry inbox, admin-only partner assignment, hashed webhook-key configuration and `(form_id,response_id)` deduplication.
- Deploy `supabase/functions/forms-sync/index.ts` as `forms-sync`, with legacy JWT verification **enabled**. The function accepts only the four configured Forms and a matching `x-sigma-sync-key`.
- Apps Script source: `integrations/google-forms-sync.gs` (downloadable from admin → Form enquiries → Connect Google Forms). Google project: https://script.google.com/home/projects/1Ym3uhHBuihV8ob2aYfyn55bDCcSO8azirjcok-Da2cYpFTfJZuvTGzhO/edit
- In the private form owner's Apps Script project, set `SIGMA_SYNC_KEY` and the public legacy `SUPABASE_ANON_KEY` in Script Properties. Generate the former from the admin setup dialog; only its SHA-256 hash is stored by Supabase. Never put the service role key in Apps Script or frontend code.
- Run `sigmaInstall` once and authorize the Forms/external-request/trigger scopes. It installs one submit trigger per form, a five-minute retry/backfill trigger and imports existing responses. Installation is idempotent. Keep the script private; no web-app deployment is needed.
- Before Google authorization and successful installation, sync is **not active**. Inspect Apps Script Executions for successful `sigmaInstall` / `sigmaSweep` runs; failures do not log response data.
- Submitted partner emails are self-reported and do not grant account access. Admin confirms an existing partner in Form enquiries; RLS then permits that partner to see the answers. Polling refreshes this page every 20 seconds. Form submissions cannot create approved policies, earnings or payments.
