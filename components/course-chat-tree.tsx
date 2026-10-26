'use client';

import { SidebarSection, FolderIcon } from './sidebar-section';
import type { ReactNode } from 'react';

export type TreeChat = { id: string; title: string; projectId: string | null; sectionFolderId?: string | null };
export type TreeFolder = { id: string; name: string; parent_course_id?: string | null };
export type TreeCourse = { id: string; name: string };

/** Course → graded section → chat, using the persisted section link rather than a title guess. */
export function CourseChatTree({ courses, folders, chats, activeId, disabled, onCourse, onSection, onChat, storageKey, renderChatAction, renamingId, onRenameCommit }: {
  courses: TreeCourse[]; folders: TreeFolder[]; chats: TreeChat[]; activeId: string | null; disabled?: boolean;
  onCourse: (course: TreeCourse) => void; onSection: (folder: TreeFolder, course: TreeCourse) => void; onChat: (chat: TreeChat) => void; storageKey: string;
  renderChatAction?: (chat: TreeChat) => ReactNode; renamingId?: string | null; onRenameCommit?: (id: string, title: string) => void;
}) {
  const courseIds = new Set(courses.map(c => c.id));
  const chatRow = (chat: TreeChat) => <div key={chat.id} className="group flex min-w-0 items-center rounded-lg hover:bg-surface-200 aria-[current=page]:bg-surface-300">
    {renamingId === chat.id && onRenameCommit ? <input autoFocus defaultValue={chat.title} aria-label="Chat name" className="min-w-0 flex-1 rounded-lg bg-surface-000 px-2 py-1.5 text-[13px] outline-none ring-1 ring-brand" onBlur={e => onRenameCommit(chat.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> :
      <button disabled={disabled} type="button" aria-current={activeId === chat.id ? 'page' : undefined} onClick={() => onChat(chat)} title={chat.title} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[13px] aria-[current=page]:bg-surface-300">{chat.title || 'Untitled chat'}</button>}
    {renderChatAction?.(chat)}
  </div>;
  return <SidebarSection storageKey={storageKey} title="Courses">
    <nav aria-label="Course chats" className="space-y-1">
      {courses.map(course => {
        const sections = folders.filter(f => f.parent_course_id === course.id).sort((a, b) => a.name.localeCompare(b.name));
        const direct = chats.filter(c => c.projectId === course.id && (!c.sectionFolderId || !sections.some(f => f.id === c.sectionFolderId)));
        return <details key={course.id} className="group/course rounded-xl" open>
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-medium hover:bg-surface-200 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-ink-subtle transition group-open/course:rotate-90">›</span>
            <button type="button" disabled={disabled} onClick={e => { e.preventDefault(); onCourse(course); }} className="min-w-0 flex-1 truncate text-left" title={course.name}>{course.name}</button>
          </summary>
          <div className="ml-3 border-l border-line pl-2">
            {sections.map(section => {
              const sectionChats = chats.filter(c => c.projectId === course.id && c.sectionFolderId === section.id);
              return <details key={section.id} className="group/section-tree" open>
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-200 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="text-ink-subtle transition group-open/section-tree:rotate-90">›</span>
                  <FolderIcon /><button type="button" disabled={disabled} title={section.name} onClick={e => { e.preventDefault(); onSection(section, course); }} className="min-w-0 flex-1 truncate text-left">{section.name}</button>
                  {sectionChats.length > 0 && <small className="text-ink-subtle">{sectionChats.length}</small>}
                </summary>
                <div className="ml-4 border-l border-line pl-2">{sectionChats.map(chatRow)}</div>
              </details>;
            })}
            {direct.map(chatRow)}
          </div>
        </details>;
      })}
      {!courses.length && <p className="px-3 py-2 text-xs text-ink-subtle">No courses yet.</p>}
      {chats.some(c => c.projectId && !courseIds.has(c.projectId) && c.sectionFolderId) && <p className="px-3 py-2 text-xs text-ink-subtle">Some section chats need the course update before they can appear here.</p>}
    </nav>
  </SidebarSection>;
}
