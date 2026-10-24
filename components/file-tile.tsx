import { materialType } from '@/lib/courses/file-display';

/** File-type tile: extension label on a colour that tells PDFs, documents, slides, sheets and images apart. */
export function FileTile({ name, kind, size = 40 }: { name: string; kind?: string; size?: number }) {
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  const type = { images: 'img', pdf: 'pdf', docs: 'doc', slides: 'ppt', sheets: 'xls', other: 'other' }[materialType({ name, kind })];
  return (
    <span aria-hidden className={`ft ft-${type} grid shrink-0 place-items-center rounded-xl font-semibold uppercase`} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.24) }}>
      {type === 'img' ? 'IMG' : (ext || 'file').slice(0, 4)}
    </span>
  );
}


