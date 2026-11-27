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
