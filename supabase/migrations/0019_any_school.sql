-- Orbit 0019: students from any school can sign up (the app checks the school email, lib/auth/eligibility.ts),
-- so count every verified signup in analytics, not only @uwo.ca ones. Safe to run twice.
create or replace function public.record_verified_signup() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.email_confirmed_at is not null then
   insert into public.analytics_events(user_id,event,dedupe_key) values(new.id,'signup','signup:'||new.id) on conflict(dedupe_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.record_verified_signup() from public,anon,authenticated;
