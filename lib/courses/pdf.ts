import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { COURSES } from '@/config/courses';
import type { TurnDocument } from '@/lib/providers/types';
import type { SourceChunk } from './parse';

export type SyllabusPdf = { documents: TurnDocument[]; sources: SourceChunk[]; pageCount: number };

/** Called only after the route checks ownership and claims the import lease. Never omit visual pages. */
export async function prepareSyllabusPdf(db: SupabaseClient, file: {
  id: string; storage_path: string; status: string; visual_pages: number[] | null;
}): Promise<SyllabusPdf> {
  const { data: blob, error } = await db.storage.from('uploads').download(file.storage_path);
  if (error || !blob) throw new Error('syllabus_pdf_unreadable');
  if (blob.size > COURSES.maxPdfBytes) throw new Error('syllabus_pdf_too_large');
  let source: PDFDocument;
  try { source = await PDFDocument.load(await blob.arrayBuffer()); }
  catch { throw new Error('syllabus_pdf_unreadable'); }
  const pages = file.status === 'needs_ocr'
    ? Array.from({ length: source.getPageCount() }, (_, i) => i + 1)
    : [...new Set(file.visual_pages ?? [])].sort((a, b) => a - b);
  if (!pages.length || pages.some(p => !Number.isInteger(p) || p < 1 || p > source.getPageCount())) throw new Error('syllabus_pdf_unreadable');
  if (pages.length > COURSES.maxVisualPages) throw new Error('syllabus_pdf_too_large');
  try {
    const selected = await PDFDocument.create();
    for (const page of await selected.copyPages(source, pages.map(p => p - 1))) selected.addPage(page);
    const bytes = await selected.save();
    if (bytes.length > COURSES.maxPdfBytes) throw new Error('syllabus_pdf_too_large');
    return {
      documents: [{ name: 'syllabus-visual-pages.pdf', mime: 'application/pdf', data: Buffer.from(bytes).toString('base64') }],
      // File-level evidence IDs are stable and owner-checked again during confirmation.
      sources: pages.map((page, i) => ({ id: file.id, page, content: `Read attached PDF page ${i + 1} as original syllabus page ${page}. Use this source ID for evidence on that page; include the original page number in item details.` })),
      pageCount: pages.length,
    };
  } catch (e) {
    if (e instanceof Error && e.message === 'syllabus_pdf_too_large') throw e;
    throw new Error('syllabus_pdf_unreadable');
  }
}
