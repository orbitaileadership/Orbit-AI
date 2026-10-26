// Visual pieces for the course workspace: a stable colour per course, calendar date tiles, due-date grouping
// and progress. Presentation only; course data and saving stay in components/course-workspace.tsx.
import type { Course, CourseItem } from '@/lib/courses/types';

/** Each course keeps one categorical colour (--viz-1..8), chosen from its id so it never changes between visits. */
export function courseColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--viz-${(h % 8) + 1})`;
}

/** "ECON 1021" → "EC", "Intro to Psychology" → "IP". */
function initials(name: string) {
  const code = name.match(/^([A-Za-z]{2,5})\s*\d/);
  if (code) return code[1].slice(0, 2).toUpperCase();
  return name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && !/^(to|of|and|the|in|for)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';
}

export function CourseBadge({ course, size = 28 }: { course: Pick<Course, 'id' | 'name'>; size?: number }) {
  const c = courseColor(course.id);
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-lg font-semibold text-ink"
    style={{ width: size, height: size, fontSize: size * 0.38, background: `color-mix(in srgb, ${c} 22%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 45%, transparent)` }}>{initials(course.name)}</span>;
}

/** Whole days from today (local) to a YYYY-MM-DD date; negative = past. */
export function daysUntil(due: string, now = new Date()) {
  const [y, m, d] = due.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

export function dueLabel(item: CourseItem, now = new Date()) {
  if (!item.due) return 'Date unconfirmed';
  const n = daysUntil(item.due, now);
  if (n < -1) return `${-n} days overdue`;
  if (n === -1) return 'Due yesterday';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n < 7) return `Due in ${n} days`;
  return `Due in ${Math.round(n / 7)} week${n >= 11 ? 's' : ''}`;
}

/** Calendar tile: month over day ("OCT / 24"); a dashed "?" while the date is unconfirmed. */
export function DateTile({ due, urgent }: { due: string | null; urgent?: boolean }) {
  if (!due) return <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong text-sm text-ink-subtle">?</span>;
  const date = new Date(`${due}T12:00:00Z`);
  return <span aria-hidden className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border ${urgent ? 'border-danger/40 bg-danger-surface' : 'border-line bg-surface-000'}`}>
    <span className={`text-[9px] font-semibold uppercase tracking-wider ${urgent ? 'text-danger' : 'text-ink-muted'}`}>{new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(date)}</span>
    <span className="text-[17px] font-medium leading-none tabular-nums">{date.getUTCDate()}</span>
  </span>;
}

export const KIND_LABEL: Record<CourseItem['kind'], string> = { assignment: 'Assignment', exam: 'Exam', topic: 'Topic' };
export const STATUS_LABEL: Record<CourseItem['status'], string> = { todo: 'Not started', doing: 'In progress', done: 'Completed' };

export function StatusPill({ status }: { status: CourseItem['status'] }) {
  const tone = status === 'done' ? 'var(--viz-3)' : status === 'doing' ? 'var(--viz-1)' : 'var(--ink-subtle)';
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-200 px-2 py-0.5 text-[11px] text-ink-muted">
    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />{STATUS_LABEL[status]}
  </span>;
}

/** Due-date buckets for "My week", in display order. Items without a date go last for the student to confirm. */
export function groupByDue<T>(rows: T[], dueOf: (row: T) => string | null, now = new Date()) {
  const groups: { label: string; urgent?: boolean; rows: T[] }[] = [
    { label: 'Overdue', urgent: true, rows: [] }, { label: 'This week', rows: [] }, { label: 'Next week', rows: [] },
    { label: 'Later', rows: [] }, { label: 'Needs a date', rows: [] },
  ];
  for (const row of rows) {
    const due = dueOf(row);
    const n = due ? daysUntil(due, now) : null;
    groups[n === null ? 4 : n < 0 ? 0 : n < 7 ? 1 : n < 14 ? 2 : 3].rows.push(row);
  }
  return groups.filter(g => g.rows.length);
}

/** Share of a course's assignments and exams marked completed. */
export function courseProgress(course: Course) {
  const work = (course.course_data?.items ?? []).filter(i => i.kind !== 'topic');
  const done = work.filter(i => i.status === 'done').length;
  return { done, total: work.length, pct: work.length ? Math.round((done / work.length) * 100) : 0 };
}

export function ProgressBar({ course }: { course: Course }) {
  const p = courseProgress(course);
  return <span className="flex items-center gap-2 text-[11px] tabular-nums text-ink-subtle">
    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-300" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.name} progress`}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${p.pct}%`, background: courseColor(course.id) }} />
    </span>
    {p.done}/{p.total}
  </span>;
}
