-- New trials receive USD $3. Existing enrollments and balances are preserved.
insert into public.settings(key,value) values ('trial_allowance_usd_micros','3000000') on conflict (key) do nothing;

create or replace function public.reserve_budget_v2(
 p_user_id uuid, p_request_id text, p_model_id text, p_kind text, p_bound_micros bigint,
 p_metadata jsonb default '{}', p_price_snapshot jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rate numeric; v_cad bigint; v_usd bigint; v_days integer; v_result jsonb; v_enroll public.enrollments%rowtype;
begin
 -- Serialize this user's creation/reservations and duplicate request IDs (also across users).
 perform pg_advisory_xact_lock(hashtextextended(p_request_id,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 if exists(select 1 from public.ledger where request_id=p_request_id) then
   return jsonb_build_object('ok',false,'reason','duplicate');
 end if;
 if coalesce((select value::text::boolean from public.settings where key='global_stop'),false) then
   return jsonb_build_object('ok',false,'reason','global_stop');
 end if;
 if p_metadata->>'conversationId' is not null and not exists(
   select 1 from public.conversations where id=(p_metadata->>'conversationId')::uuid and user_id=p_user_id
 ) then raise exception 'conversation ownership'; end if;
 if not exists(select 1 from public.budgets where user_id=p_user_id) then
   v_rate := (select value::text::numeric from public.settings where key='usd_cad_rate');
   if v_rate is null or v_rate <= 0 then return jsonb_build_object('ok',false,'reason','fx_not_configured'); end if;
   select * into v_enroll from public.enrollments where user_id=p_user_id;
   if not found then
     v_usd := coalesce((select value::text::bigint from public.settings where key='trial_allowance_usd_micros'),3000000);
     v_cad := ceil(v_usd*v_rate);
     v_days := coalesce((select value::text::integer from public.settings where key='trial_days'),7);
     insert into public.enrollments(user_id,trial_days,trial_ends_at,allowance_cad_micros)
       values(p_user_id,v_days,now()+make_interval(days=>v_days),v_cad) returning * into v_enroll;
     insert into public.analytics_events(user_id,event,dedupe_key) values(p_user_id,'trial_activated','trial:'||p_user_id);
   end if;
   insert into public.budgets(user_id,allowance_micros,allowance_cad_micros,usd_cad_rate,expires_at)
     values(p_user_id,coalesce(v_usd,floor(v_enroll.allowance_cad_micros/v_rate)),v_enroll.allowance_cad_micros,v_rate,
       case when v_enroll.plan='trial' then v_enroll.trial_ends_at else null end);
 end if;
 if exists(select 1 from public.budgets where user_id=p_user_id and expires_at<=now()) then
   return jsonb_build_object('ok',false,'reason','trial_expired');
 end if;
 v_result := public.reserve_budget(p_user_id,p_request_id,p_model_id,p_kind,p_bound_micros);
 if (v_result->>'ok')::boolean then
   update public.ledger set provider=p_metadata->>'provider', operation=coalesce(p_metadata->>'operation','chat'),
     conversation_id=(p_metadata->>'conversationId')::uuid,
     usd_cad_rate=(select usd_cad_rate from public.budgets where user_id=p_user_id),
     metadata=p_metadata, price_snapshot=p_price_snapshot where request_id=p_request_id;
 end if;
 return v_result;
end $$;

revoke all on function public.reserve_budget_v2(uuid,text,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_budget_v2(uuid,text,text,text,bigint,jsonb,jsonb) to service_role;
