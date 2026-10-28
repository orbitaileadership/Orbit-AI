/** Shared display rules for course and assignment materials; no context-selection behavior. */
export type MaterialFile = {
  id: string;
  name: string;
  status: string;
  kind?: string;
  page_count?: number | null;
  retained_for_course?: boolean;
};

export const MATERIAL_TYPES = [
  { id: 'all', label: 'All file types' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'docs', label: 'Documents' },
  { id: 'slides', label: 'Slides' },
  { id: 'sheets', label: 'Spreadsheets' },
  { id: 'images', label: 'Images' },
  { id: 'other', label: 'Other files' },
] as const;

export type MaterialType = typeof MATERIAL_TYPES[number]['id'];
export type MaterialSort = 'recent' | 'name' | 'type';

export function materialType(file: Pick<MaterialFile, 'name' | 'kind'>): Exclude<MaterialType, 'all'> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (file.kind === 'image' || /^(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?)$/.test(ext)) return 'images';
  if (ext === 'pdf') return 'pdf';
  if (/^(docx?|odt|rtf|txt|md)$/.test(ext)) return 'docs';
  if (/^(pptx?|key|odp)$/.test(ext)) return 'slides';
  if (/^(xlsx?|xlsm|csv|tsv|ods)$/.test(ext)) return 'sheets';
  return 'other';
}

export function materialStatus(file: MaterialFile): string {
  if (file.status === 'failed') return 'Could not be read · try another copy';
  if (file.status === 'needs_ocr') return 'Scanned · limited text retrieval';
  if (file.status === 'queued' || file.status === 'processing') return 'Indexing · AI can use it when ready';
  if (file.status !== 'ready') return 'Reading file…';
  const type = materialType(file);
  if (type === 'images') return 'Image · support varies by AI mode';
  if (file.page_count) {
    const unit = type === 'slides' ? 'slide' : type === 'sheets' ? 'sheet' : 'page';
    return `${file.page_count} ${unit}${file.page_count === 1 ? '' : 's'} · Ready`;
  }
  return 'Ready for relevant excerpts';
}

export function selectMaterials<T extends MaterialFile>(files: T[], query: string, type: MaterialType, sort: MaterialSort): T[] {
  const text = query.trim().toLocaleLowerCase();
  const selected = files.filter(file => file.name.toLocaleLowerCase().includes(text) && (type === 'all' || materialType(file) === type));
  if (sort === 'recent') return selected; // API and upload insertion already put newest first.
  return selected.sort((a, b) => {
    const group = sort === 'type' ? materialType(a).localeCompare(materialType(b)) : 0;
    return group || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}
