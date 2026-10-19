import { createAdminClient } from "@/lib/supabase/admin";
export type Metric = number | string | null;
export type TokenUsageReport = { days:number; modelId:string|null; userId:string|null; modelOptions:string[];
  summary:Record<string,Metric>; growth:Record<string,Metric>[]; complexity:Record<string,Metric>[]; users:Record<string,Metric>[] };
export type AnalyticsReport = { days:number; financial:Record<string,Metric>; product:Record<string,Metric>; context:Record<string,Metric>;
  cohorts:Record<string,Metric>[]; models:Record<string,Metric>[]; features:Record<string,Metric>[]; users:Record<string,Metric>[]; tokenUsage?:TokenUsageReport|null };
export function validAnalyticsFilters(days:number,model?:string,user?:string) {
  return Number.isInteger(days)&&days>=1&&days<=90&&(!model||/^[a-zA-Z0-9_-]{1,80}$/.test(model))&&(!user||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user));
}
export async function loadAnalyticsReport(days=30,model?:string,user?:string): Promise<AnalyticsReport> {
  if(!validAnalyticsFilters(days,model,user))throw new Error('invalid_filters');
  const admin=createAdminClient();
  const [{data,error},tokens]=await Promise.all([
    admin.rpc("orbit_analytics_report",{p_days:days}),
    admin.rpc('orbit_token_usage_report',{p_days:days,p_model_id:model||null,p_user_id:user||null}),
  ]);
  if(error || !data) throw new Error("analytics_unavailable");
  return {...data as AnalyticsReport,tokenUsage:tokens.error?null:tokens.data as TokenUsageReport|null};
}
