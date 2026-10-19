import { beforeEach, expect, it, vi } from 'vitest';
const s=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:s.rpc})}));
import { loadAnalyticsReport,validAnalyticsFilters } from './report';
beforeEach(()=>{vi.clearAllMocks();s.rpc.mockImplementation(async(name:string)=>name==='orbit_analytics_report'?{data:{days:7,financial:{}},error:null}:{data:{summary:{calls:3}},error:null});});
it('passes validated filters only to token reports and keeps existing operational reporting',async()=>{
 const user='11111111-1111-4111-8111-111111111111';
 expect(await loadAnalyticsReport(7,'openai-luna',user)).toMatchObject({days:7,tokenUsage:{summary:{calls:3}}});
 expect(s.rpc).toHaveBeenCalledWith('orbit_token_usage_report',{p_days:7,p_model_id:'openai-luna',p_user_id:user});
 expect(s.rpc).toHaveBeenCalledWith('orbit_analytics_report',{p_days:7});
});
it('degrades gracefully before the new report migration is available',async()=>{
 s.rpc.mockImplementation(async(name:string)=>name==='orbit_analytics_report'?{data:{days:30},error:null}:{data:null,error:{code:'42883'}});
 expect(await loadAnalyticsReport()).toMatchObject({days:30,tokenUsage:null});
});
it('rejects invalid filters before accessing the database',async()=>{
 for(const value of [0,91,NaN,Infinity,1.5])expect(validAnalyticsFilters(value)).toBe(false);
 expect(validAnalyticsFilters(30,'x; select','bad-user')).toBe(false);
 await expect(loadAnalyticsReport(NaN)).rejects.toThrow('invalid_filters');expect(s.rpc).not.toHaveBeenCalled();
});
