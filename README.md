# Incremint Partner Studio

A responsive monochrome insurance partner dashboard inspired by the supplied screenshots.

Run `node serve.mjs` and open http://127.0.0.1:4173. No dependencies or build step.

Run `node verify.mjs` for functional smoke checks.

Includes overview analytics, booking creation and issuance, lead pipeline stages, contact editing, renewals, sample payouts and rate cards, referral link copying, personalised downloadable SVG marketing creatives, CSV exports, JSON backup and restore, help search, and an illustrative premium calculator.

This is a browser-local prototype with clearly labelled sample data. Browser localStorage retains records. The assistant uses local response templates, not a live AI model. Authentication, a shared database, insurer quotes, payouts, policy issuance, WhatsApp delivery and tracked referrals require backend services and credentials before production use. Marking a policy issued or renewed only updates the local demo record.

Typography uses Google Fonts with system sans-serif fallbacks. All interface graphics are inline SVG.
