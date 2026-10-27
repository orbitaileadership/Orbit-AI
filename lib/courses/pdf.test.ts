import { beforeEach, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fakeSupabase } from '@/test/fake-supabase';
import { COURSES } from '@/config/courses';
import { prepareSyllabusPdf } from './pdf';

const file = { id: '11111111-1111-4111-8111-111111111111', storage_path: 'u/syllabus.pdf', status: 'ready', visual_pages: [3, 1, 3] };
let fake: ReturnType<typeof fakeSupabase>;
const prepare = (f = file) => prepareSyllabusPdf(fake.client as unknown as SupabaseClient, f);
async function storePdf(pages: number) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([300 + i, 400]);
  fake.storage[file.storage_path] = { bytes: await pdf.save(), type: 'application/pdf' };
}
beforeEach(async () => { fake = fakeSupabase(); await storePdf(3); });
describe('syllabus PDF preparation', () => {
  it('sends all visual pages once in original order with stable, mapped source IDs', async () => {
    const result = await prepare();
    const pdf = await PDFDocument.load(Buffer.from(result.documents[0].data, 'base64'));
    expect(pdf.getPages().map(p => p.getWidth())).toEqual([300, 302]);
    expect(result.pageCount).toBe(2);
    expect(result.sources.map(s => [s.id, s.page])).toEqual([[file.id, 1], [file.id, 3]]);
    expect(result.sources[1].content).toContain('attached PDF page 2 as original syllabus page 3');
  });
  it('includes every page of a scanned PDF, even without indexed visual metadata', async () => {
    const result = await prepare({ ...file, status: 'needs_ocr', visual_pages: [] });
    expect(result.sources.map(s => s.page)).toEqual([1, 2, 3]);
    expect(result.pageCount).toBe(3);
  });
  it('rejects excessive visual pages instead of silently dropping the remainder', async () => {
    await storePdf(COURSES.maxVisualPages + 1);
    await expect(prepare({ ...file, status: 'needs_ocr' })).rejects.toThrow('syllabus_pdf_too_large');
  });
  it('fails clearly on missing, corrupt, or invalid-page documents', async () => {
    await expect(prepare({ ...file, visual_pages: [4] })).rejects.toThrow('syllabus_pdf_unreadable');
    fake.storage[file.storage_path].bytes = new Uint8Array([1, 2, 3]);
    await expect(prepare()).rejects.toThrow('syllabus_pdf_unreadable');
    delete fake.storage[file.storage_path];
    await expect(prepare()).rejects.toThrow('syllabus_pdf_unreadable');
  });
  it('bounds PDF bytes before parsing', async () => {
    fake.storage[file.storage_path].sizeOverride = COURSES.maxPdfBytes + 1;
    await expect(prepare()).rejects.toThrow('syllabus_pdf_too_large');
    expect(fake.storageCalls.downloads).toBe(0);
  });
});
