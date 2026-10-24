-- Rolling usage limits. Apply separately before deploying the v3 application caller.
-- No paid enrollment, balance refill, historical rewrite, or payment activation.
create table if not exists public.usage_limit_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 usd_cad_rate numeric not null check (usd_cad_rate > 0 and usd_cad_rate <> 'NaN'::numeric),
 created_at timestamptz not null default now()
);
alter table public.usage_limit_accounts enable row level security;
revoke all on public.usage_limit_accounts from public, anon, authenticated;

create or replace function public.usage_windows(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_rate numeric; v_month bigint; v_now timestamptz := statement_timestamp(); v_windows jsonb;
begin
 v_rate := coalesce(
   (select usd_cad_rate from public.usage_limit_accounts where user_id=p_user_id),
   (select usd_cad_rate from public.budgets where user_id=p_user_id),
   (select value::text::numeric from public.settings where key='usd_cad_rate'));
 if v_rate is null or v_rate<=0 or v_rate='NaN'::numeric then
   return jsonb_build_object('ok',false,'reason','fx_not_configured');
 end if;
 v_month := floor(coalesce((select value::text::numeric from public.settings where key='monthly_allowance_cad_micros'),20000000)/v_rate);
 if v_month<=0 then return jsonb_build_object('ok',false,'reason','budget'); end if;
 select jsonb_agg(jsonb_build_object(
   'key',w.key,'duration_seconds',w.seconds,'limit_micros',w.cap,
   'spent_micros',coalesce(s.spent,0),'reserved_micros',coalesce(s.held,0),
   'next_release_at',s.next_release
 ) order by w.seconds) into v_windows
 from (values ('daily',86400,floor(v_month::numeric/30)::bigint),
              ('weekly',604800,floor(v_month::numeric*7/30)::bigint),
              ('monthly',2592000,v_month)) w(key,seconds,cap)
 cross join lateral (
   select
     sum(case when l.state in ('settled','uncertain') and l.created_at>v_now-make_interval(secs=>w.seconds)
         then coalesce(l.actual_micros,l.reserved_micros) else 0 end) as spent,
     sum(case when l.state='reserved' then l.reserved_micros else 0 end) as held,
     min(case when l.state in ('settled','uncertain') and coalesce(l.actual_micros,l.reserved_micros)>0
         and l.created_at>v_now-make_interval(secs=>w.seconds)
         then l.created_at+make_interval(secs=>w.seconds) end) as next_release
   from public.ledger l where l.user_id=p_user_id
     and (l.state='reserved' or l.created_at>v_now-interval '720 hours')
 ) s;
 return jsonb_build_object('ok',true,'usd_cad_rate',v_rate,'windows',v_windows);
end $$;

-- Keep the original implementation private; every public reservation entry point reaches the guard.
-- Guarded on reruns so we never copy the wrapper into its own internal implementation.
do $$ begin
 if to_regprocedure('public.reserve_budget_internal(uuid,text,text,text,bigint)') is null then
   execute replace(pg_get_functiondef('public.reserve_budget(uuid,text,text,text,bigint)'::regprocedure),
     'FUNCTION public.reserve_budget(', 'FUNCTION public.reserve_budget_internal(');
 end if;
end $$;
revoke all on function public.reserve_budget_internal(uuid,text,text,text,bigint) from public,anon,authenticated,service_role;

create or replace function public.reserve_budget(
 p_user_id uuid,p_request_id text,p_model_id text,p_kind text,p_bound_micros bigint
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_usage jsonb; v_window jsonb; v_result jsonb; v_left bigint; v_min bigint;
begin
 if p_bound_micros is null or p_bound_micros<=0 then raise exception 'invalid bound'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 if exists(select 1 from public.ledger where request_id=p_request_id) then
   return jsonb_build_object('ok',false,'reason','duplicate');
 end if;
 if coalesce((select value::text::boolean from public.settings where key='global_stop'),false) then
   return jsonb_build_object('ok',false,'reason','global_stop');
 end if;
 -- Even legacy callers initialize via v2, ensuring one entitlement/FX source before the guard.
 if not exists(select 1 from public.budgets where user_id=p_user_id) then
   return public.reserve_budget_v2(p_user_id,p_request_id,p_model_id,p_kind,p_bound_micros);
 end if;
 -- Settlement updates this same row before changing ledger charges. Hold it through the check+reserve.
 perform 1 from public.budgets where user_id=p_user_id for update;
 if exists(select 1 from public.budgets where user_id=p_user_id and expires_at<=now()) then
   return jsonb_build_object('ok',false,'reason','trial_expired');
 end if;
 v_usage := public.usage_windows(p_user_id);
 if not (v_usage->>'ok')::boolean then return v_usage; end if;
 for v_window in select value from jsonb_array_elements(v_usage->'windows') loop
   v_left := (v_window->>'limit_micros')::bigint-(v_window->>'spent_micros')::bigint-(v_window->>'reserved_micros')::bigint;
   v_min := least(v_min,v_left);
   if v_left<p_bound_micros then
     return jsonb_build_object('ok',false,'reason','budget','limit_window',v_window->>'key','remaining_micros',greatest(0,v_left));
   end if;
 end loop;
 v_result := public.reserve_budget_internal(p_user_id,p_request_id,p_model_id,p_kind,p_bound_micros);
 if (v_result->>'ok')::boolean then
   -- Rejected first attempts never pin a different exchange rate than the created entitlement.
   insert into public.usage_limit_accounts(user_id,usd_cad_rate)
     values(p_user_id,(v_usage->>'usd_cad_rate')::numeric) on conflict(user_id) do nothing;
   v_result := v_result || jsonb_build_object('remaining_micros',greatest(0,least((v_result->>'remaining_micros')::bigint,v_min-p_bound_micros)));
 end if;
 return v_result;
end $$;

create or replace function public.reserve_budget_v3(
 p_user_id uuid,p_request_id text,p_model_id text,p_kind text,p_bound_micros bigint,
 p_metadata jsonb default '{}',p_price_snapshot jsonb default '{}'
) returns jsonb language sql security definer set search_path=public as $$
 select public.reserve_budget_v2(p_user_id,p_request_id,p_model_id,p_kind,p_bound_micros,p_metadata,p_price_snapshot);
$$;
revoke all on function public.usage_windows(uuid) from public,anon,authenticated;
grant execute on function public.usage_windows(uuid) to service_role;
revoke all on function public.reserve_budget(uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_budget(uuid,text,text,text,bigint) to service_role;
revoke all on function public.reserve_budget_v3(uuid,text,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_budget_v3(uuid,text,text,text,bigint,jsonb,jsonb) to service_role;
