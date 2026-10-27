-- A request's first reservation snapshots 1% of its remaining rolling daily allowance.
-- Ledger rows remain the only source of spent and reserved amounts. This table stores the
-- immutable ceiling, so later tool rounds, summaries, retries and concurrent calls share it.
create table public.request_spend_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_request_id text not null check (length(parent_request_id) between 1 and 128),
  ceiling_micros bigint not null check (ceiling_micros >= 0),
  denied_attempts integer not null default 0 check (denied_attempts >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, parent_request_id)
);
alter table public.request_spend_limits enable row level security;
revoke all on public.request_spend_limits from public, anon, authenticated;
create index if not exists ledger_parent_request_spend_idx on public.ledger(user_id, (metadata->>'parentRequestId'));

create or replace function public.reserve_budget_v3(
 p_user_id uuid,p_request_id text,p_model_id text,p_kind text,p_bound_micros bigint,
 p_metadata jsonb default '{}',p_price_snapshot jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_parent text; v_usage jsonb; v_daily jsonb; v_left bigint; v_limit bigint;
  v_used bigint; v_result jsonb;
begin
 if p_bound_micros is null or p_bound_micros<=0 or coalesce(jsonb_typeof(p_metadata),'')<>'object' then
   return jsonb_build_object('ok',false,'reason','bad_bound');
 end if;
 v_parent := coalesce(nullif(p_metadata->>'parentRequestId',''),p_request_id);
 if v_parent is null or length(v_parent)>128 then
   return jsonb_build_object('ok',false,'reason','bad_request_id');
 end if;
 -- Match the existing per-user reservation serialization. A snapshot and every child
 -- reservation are checked while the same user's spending state is locked.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 if exists(select 1 from public.ledger where request_id=p_request_id) then
   return jsonb_build_object('ok',false,'reason','duplicate');
 end if;
 if coalesce((select value::text::boolean from public.settings where key='global_stop'),false) then
   return jsonb_build_object('ok',false,'reason','global_stop');
 end if;
 select ceiling_micros into v_limit from public.request_spend_limits
   where user_id=p_user_id and parent_request_id=v_parent for update;
 if not found then
   v_usage := public.usage_windows(p_user_id);
   if not coalesce((v_usage->>'ok')::boolean,false) then return v_usage; end if;
   select value into v_daily from jsonb_array_elements(v_usage->'windows') where value->>'key'='daily';
   if v_daily is null then return jsonb_build_object('ok',false,'reason','error'); end if;
   v_left := greatest(0,(v_daily->>'limit_micros')::bigint-(v_daily->>'spent_micros')::bigint-(v_daily->>'reserved_micros')::bigint);
   v_limit := floor(v_left::numeric/100)::bigint;
   insert into public.request_spend_limits(user_id,parent_request_id,ceiling_micros)
     values(p_user_id,v_parent,v_limit);
 end if;
 select coalesce(sum(case when state='reserved' then reserved_micros
     when state in ('settled','uncertain') then coalesce(actual_micros,reserved_micros)
     else 0 end),0)::bigint into v_used
   from public.ledger where user_id=p_user_id and metadata->>'parentRequestId'=v_parent;
 v_left := greatest(0,v_limit-v_used);
 if p_bound_micros>v_left then
   update public.request_spend_limits set denied_attempts=denied_attempts+1
     where user_id=p_user_id and parent_request_id=v_parent;
   return jsonb_build_object('ok',false,'reason','request_limit','remaining_micros',v_left);
 end if;
 v_result := public.reserve_budget_v2(p_user_id,p_request_id,p_model_id,p_kind,p_bound_micros,
   p_metadata||jsonb_build_object('parentRequestId',v_parent),p_price_snapshot);
 if (v_result->>'ok')::boolean then
   return v_result||jsonb_build_object('request_remaining_micros',v_left-p_bound_micros);
 end if;
 return v_result;
end $$;

-- The application uses v3. Older service entry points cannot skip this ceiling.
revoke all on function public.reserve_budget(uuid,text,text,text,bigint) from service_role;
revoke all on function public.reserve_budget_v2(uuid,text,text,text,bigint,jsonb,jsonb) from service_role;
revoke all on function public.reserve_budget_v3(uuid,text,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_budget_v3(uuid,text,text,text,bigint,jsonb,jsonb) to service_role;

-- Content-free admin metrics; ledger still supplies every cost and token total.
create or replace function public.request_spend_report(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
 if p_days<1 or p_days>90 then raise exception 'invalid days'; end if;
 select jsonb_build_object(
   'requests',count(*),'mean_charge_micros',coalesce(round(avg(charged_micros)),0),
   'near_limit_requests',count(*) filter(where ceiling_micros>0 and used_micros>=ceiling_micros*0.8),
   'limit_rejections',coalesce(sum(denied_attempts),0),
   'over_limit_requests',count(*) filter(where used_micros>ceiling_micros),
   'total_charged_micros',coalesce(sum(charged_micros),0)
 ) into v_result from (
   select r.ceiling_micros,r.denied_attempts,
     coalesce(sum(case when l.state in ('settled','uncertain') then coalesce(l.actual_micros,l.reserved_micros) else 0 end),0) as charged_micros,
     coalesce(sum(case when l.state='reserved' then l.reserved_micros
       when l.state in ('settled','uncertain') then coalesce(l.actual_micros,l.reserved_micros)
       else 0 end),0) as used_micros
   from public.request_spend_limits r left join public.ledger l
     on l.user_id=r.user_id and l.metadata->>'parentRequestId'=r.parent_request_id
   where r.created_at>=statement_timestamp()-make_interval(days=>p_days)
   group by r.user_id,r.parent_request_id,r.ceiling_micros,r.denied_attempts
 ) grouped;
 return v_result;
end $$;
revoke all on function public.request_spend_report(integer) from public,anon,authenticated;
grant execute on function public.request_spend_report(integer) to service_role;
