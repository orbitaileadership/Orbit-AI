import { json } from "@/lib/api";
import { requireAnalyticsAdmin } from "@/lib/analytics/admin";
import { loadAnalyticsReport, validAnalyticsFilters } from "@/lib/analytics/report";
export async function GET(request:Request) {
  const auth=await requireAnalyticsAdmin();
  if("error" in auth) return auth.error;
  const params=new URL(request.url).searchParams;
  const days=Number(params.get('days')??30),model=params.get('model')||undefined,user=params.get('user')||undefined;
  if(!validAnalyticsFilters(days,model,user)) return json({error:"bad_request"},400);
  try {return Response.json(await loadAnalyticsReport(days,model,user),{headers:{"Cache-Control":"private, no-store"}});}
  catch {return json({error:"analytics_unavailable",message:"Apply migrations 0009–0011 before opening analytics."},503);}
}
