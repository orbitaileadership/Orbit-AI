-- Exchange rate used when a new student's budget is created (reserve_budget_v2, migration 0009): the CAD trial
-- allowance is converted to USD once at this rate. Without it every new account fails with fx_not_configured
-- ("Usage billing is not configured yet"). Value = CAD per 1 USD; update it in the settings table when the rate moves.
-- Existing budgets keep the rate they were created with.
insert into public.settings (key, value) values ('usd_cad_rate', '1.38')
on conflict (key) do nothing;
