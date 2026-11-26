# Advertised plan price update

- Request: change the two monthly prices to $25 and $30.
- Result: shared CAD plan configuration sets Student to C$25/month and Regular to C$30/month. Annual prices retain the advertised 10% discount: C$270 and C$324/year. Both the public Pricing component and Settings Billing read this configuration.
- Scope: advertised plan numbers/version only. No provider rates, usage caps, database balances, trial settings, payment activation or payment transaction changes.
- Validation: check annual/monthly consistency, lint, production build and live public Pricing markup after Vercel deployment. Prior full suite passed 976 tests; no repetitive constant-only test is added for this reversible copy/configuration change.
- Release: source is pushed to the existing demo PR branch and deployed to the established Vercel Production project, with deployment SHA/READY/domain verified before reporting completion. GitHub main still follows its existing collaborator-approval requirement.
- Verified result: source `f6ec0058d2cb6bf4c2650c4af94c80db5081ba2f`, Production deployment `dpl_2exzeYnGLUSUDgBoCVXbPDFdXJ4j`, state READY, live alias `orbit-ai-sand.vercel.app`. The public homepage returned 200 and its rendered Pricing section was checked for Student CAD $25/month and Regular CAD $30/month. Annual/monthly consistency, lint and production build passed. Previous deployment `dpl_6kSSdLrZcc4wE17RX39UpgsgSknC` is the code rollback reference.
