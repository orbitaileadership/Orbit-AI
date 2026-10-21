import { failureState } from "@/lib/billing/outcome";
import { COURSES } from '@/config/courses';
import { getModel, PDF_INPUT } from '@/config/models';
import { reserve, settle, isProviderDisabled, overRateLimit } from '@/lib/billing/budget';
import { estimateTokens, reservationMicros, costMicros } from '@/lib/chat/context';
import { ADAPTERS, apiKeyFor, isLive } from '@/lib/providers';
import { ProviderError, type Usage } from '@/lib/providers/types';
import { EXTRACTION_PROMPT, parseExtraction, type SourceChunk } from './parse';
import type { SyllabusPdf } from './pdf';
export async function extractSyllabus(userId: string, chunks: SourceChunk[], signal: AbortSignal, pdf?: SyllabusPdf) {
  const model=getModel(COURSES.model), sources=[...chunks,...(pdf?.sources??[])], content=JSON.stringify(sources);
  const textInput=estimateTokens(EXTRACTION_PROMPT)+estimateTokens(content)+16;
  if(textInput>COURSES.maxInputTokens) throw new Error('syllabus_too_large');
  if(pdf && (!Number.isInteger(pdf.pageCount) || pdf.pageCount<1 || pdf.pageCount>COURSES.maxVisualPages)) throw new Error('syllabus_pdf_too_large');
  const input=textInput+(pdf?.pageCount??0)*COURSES.visualPageTokens;
  if(!isLive()) throw new Error('extraction_not_enabled');
  if(!model?.enabled || (pdf && !PDF_INPUT[model.provider]) || !apiKeyFor(model.provider) || await isProviderDisabled(model.provider)) throw new Error('provider_unavailable');
  if(input+COURSES.maxOutput>model.contextTokens) throw new Error('syllabus_too_large');
  if(await overRateLimit(userId)) throw new Error('rate_limited');
  if(signal.aborted) throw new Error('cancelled');
  const id=crypto.randomUUID();
  const r=await reserve(userId,id,model.id,'text',reservationMicros(model,input,COURSES.maxOutput),{provider:model.provider,operation:'syllabus',inputEstimate:input});
  if(!r.ok) throw new Error(r.reason);
  let text='',usage:Usage|undefined,finish='unknown';
  try {
    for await(const event of ADAPTERS[model.provider].stream({model,system:EXTRACTION_PROMPT,history:[{role:'user',content,...(pdf?{documents:pdf.documents}:{})}],maxOutput:COURSES.maxOutput,apiKey:apiKeyFor(model.provider)!,signal})) {
      if(event.delta)text+=event.delta;if(event.usage)usage=event.usage;if(event.finish)finish=event.finish;
    }
  } catch(e) {
    if(usage)await settle(id,'settled',costMicros(model,usage),usage,'syllabus_failed');
    else if(e instanceof ProviderError && failureState(e) === "released") await settle(id,'released',0,undefined,e.code);
    else await settle(id,'uncertain',0,undefined,'syllabus_failed');
    throw new Error('extraction_failed');
  }
  if(usage)await settle(id,'settled',costMicros(model,usage),usage,undefined,{finishReason:finish});
  else await settle(id,'uncertain',0,undefined,'no_usage');
  if(finish!=='stop')throw new Error('extraction_incomplete');
  return parseExtraction(text,sources);
}
