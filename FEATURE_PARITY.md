# Incremint reference audit and implementation status

Reference: https://incremint-dashboard.web.app/ — inspected while signed in on 24 November 2026. The user confirmed that only website login is available, not source code or backend/API access.

This is **partial functional parity, not a complete or exact production clone**. The reference account had no bookings, leads, contacts, prospects or network members, so populated row actions, server validation, approval decisions and actual payout behavior could not be verified. No lead, policy, invitation, trial, subscription or payment was submitted in the reference application.

**Subsequent Phase 1 scope:** a separate authenticated policy-upload → admin review → partner credit portal has now been connected to the dedicated Sigma0Nine Supabase project. The migration, private storage and production authentication redirects are applied. First-admin provisioning and the two-account hosted acceptance check are pending. See [PHASE1_SETUP.md](PHASE1_SETUP.md). The original audit below remains a historical record of the earlier browser workspace and reference comparison.

## Implemented on this device

| Reference area | Observed behavior | Sigma0Nine implementation |
| --- | --- | --- |
| Dashboard | Volume, lead points, received/pending points, product shortcuts, leads, referral, trend, product mix, current/next-month renewals | Metrics now derive from workspace records; no invented growth or earnings in the new dashboard. New workspaces start empty. Existing local data is preserved. |
| Add My Booking | Map My Lead, policy upload, AI autofill, customer verification, submit for approval | Local upload/document storage and a pending-approval record. AI and actual team approval are not connected. |
| Health lead | Base/Super Top/Port, insured family members, sum insured, pre-existing disease, optional covers, previous policy details for port | Dedicated form, family rows, conditional port step, draft persistence, review and local lead creation. |
| Motor | Fresh/Renewal, RC step, customer, vehicle/cover, review | Dedicated multi-step form and conditional renewal documents. |
| Travel | International/Domestic, customer, documents, trip details, review | Dedicated multi-step form, travellers and trip-date validation. |
| Term | Customer, gender/DOB, occupation, education, tobacco, sum assured, medical history, existing life cover | Dedicated form and review. |
| Investment | Customer, Self/Child, goal, Plan, review | Dedicated form and review. |
| Group Health / Group PA | Fresh/Port-Renewal, filled-format upload, company, employee data, requirements, review | Dedicated document and company workflows. |
| Home / Fire | Case type, filled-format upload, property/company, history, cover breakup/add-ons, review | Dedicated workflows and document references. |
| Jewellery | Business/security/stock/transit coverage RFQ | Dedicated RFQ form, review and local record. |
| Marine / Workmen Comp | Disabled in reference catalogue | Disabled in Sigma0Nine catalogue. |
| Mutual fund | SIP/Lumpsum/Both, customer, amounts, account opening, review | Local enquiry form; does not open a financial account or place an investment. |
| My Bookings | FY/month/product/search, cards/list/table, six metrics, product summary, report | Filters, views, summary, CSV, real `.xlsx` export and print/save-PDF. |
| Statement | Date filter, due/cycle/overdue/cleared, upcoming and cleared history, Excel | Imported payout-ledger reporting, dates, exports and printable report. Does not execute payments. |
| Renewals | Expired/Today/Last/This/Next/Custom, table/cards, product/flag/insurer/SP, CP/retention, report/Excel/WA | Workspace filters, CP totals, flags, notes, table/cards, reports and WhatsApp draft. |
| Leads | Product/date/search, list/kanban, six stages, collapsible columns, summary | Six stages, local stage changes, filters, notes, reports and quote linking. |
| Contacts | Duplicate mobile check, role/tag/notes, search, Recent/Leads/Prospects/Active/Inactive/Customers/Via Agent | Normalised duplicate detection, forms, filters, edits and contact conversion. |
| Prospects | Fresh/Callback/Today/Overdue/Joined, search and callbacks | Local prospect records, follow-up dates, status and filters. Actual AI-call history is unavailable. |
| Network | Invitation, team/points/received/due, ambassadors | Verified imported partner records and a configurable working referral URL. No fake tracked dashboard referral link. |
| Rate card | Categories/search, compact, plan comparison, earnings calculator | Import/manual catalogue, compare up to four plans, and earnings calculation. Reference confidential rates are not republished as Sigma0Nine rates. |
| Health Quote | Members, case type, selected plans, 1/2/3-year premiums, editable feature values, note, preview, PDF | User-entered plan and feature comparison, draft autosave, preview, saved quotes, local lead linking and browser print/PDF. |
| Niva Quote | Members, variant/cover/PA, port details, up to eight screenshots, eight components × five tenures, negative discounts, four-page PDF | Manual premium input, screenshots stored locally, calculated totals/effective annual cost, saved quotes and four-section printable document. |
| Marketing | Posters/categories/personalisation/JPG/share/caption, Videos, My Website | Own licensed media library, image footer personalisation/export, caption copy, video storage/download, advisor-page HTML export and configured public link. |
| Help / navigation | Search, guides, page pin, profile | Guides/search, profile settings and pinned pages. Sigma0Nine branding and explicit collapse behavior are preserved. |

## Still not exact or production-connected

- **Later mandatory wizard steps:** the reference prevents progression without customer information. Step sequences and the accessible first-stage fields were observed; some later-stage field names and validation are provisional. They need an approved test account or original specifications before claiming field-for-field parity.
- **Authentication and records:** no phone/email OTP provider, server sessions, database, multi-user permissions or cloud document storage is connected. Local records are not a substitute for these services.
- **Policy extraction and approval:** the original AI extraction and RM/admin workflow are private services. A local pending-approval record is never described as an approved or issued policy.
- **WhatsApp assistant:** the reference advertises automation, service plans, a trial and background delivery. Sigma0Nine provides service preferences and draft previews only. It does not impersonate a running trial, link an account, send automatically, charge subscriptions or claim reply/opt-out processing.
- **Payouts:** original commission calculation, insurer settlement, payment clearing and live cycle rules require authoritative data. Manual/imported records are reporting data, not an executed financial transaction.
- **Media:** the original 48-item proprietary artwork/video library and server personalisation are not copied. Upload licensed assets; video re-rendering and automatic hosting remain unconnected.
- **Quotes:** no original insurer catalogue or AI screenshot extraction is connected. A browser-print document is provided; it is not a verified original four-page PDF template or insurer-issued quote. Plan descriptions and premiums must be supplied and verified by the advisor.
- **Referrals/public website:** actual onboarding, attribution and public lead submission require a deployed backend. Exporting HTML does not publish it.
- **Original contacts/data:** no original private customer or account data was copied into the public Vercel deployment.

## Validation

`node verify.mjs` checks all routes, generated inline-handler syntax, sidebar behavior, product schemas, conditional port flow, stage transitions, search filters, quote validation, payout arithmetic, CSV parsing/export, safe workbook text cells, ZIP CRC and earnings calculations.

Browser checks used synthetic data only on localhost: Health lead review/save, contact creation, lead stage update, duplicate-mobile rejection, manual rate creation, earnings calculation, Niva discount totals and saved-quote/lead linking. Native file-chooser automation stalled before an upload could be completed; end-to-end browser upload validation remains incomplete. No reference-system records were created.
