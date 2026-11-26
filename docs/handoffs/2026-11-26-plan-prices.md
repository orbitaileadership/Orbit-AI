# Advertised plan price update

- Request: change the two monthly prices to $25 and $30.
- Result: shared CAD plan configuration sets Student to C$25/month and Regular to C$30/month. Annual prices retain the advertised 10% discount: C$270 and C$324/year. Both the public Pricing component and Settings Billing read this configuration.
- Scope: advertised plan numbers/version only. No provider rates, usage caps, database balances, trial settings, payment activation or payment transaction changes.
- Validation: check annual/monthly consistency, lint, production build and live public Pricing markup after Vercel deployment. Prior full suite passed 976 tests; no repetitive constant-only test is added for this reversible copy/configuration change.
- Release: source is pushed to the existing demo PR branch and deployed to the established Vercel Production project, with deployment SHA/READY/domain verified before reporting completion. GitHub main still follows its existing collaborator-approval requirement.
