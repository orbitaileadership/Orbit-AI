import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseChatTree } from './course-chat-tree';

it('nests a saved chat under its graded section and parent course', () => {
  const html = renderToStaticMarkup(<CourseChatTree storageKey="test-course-tree"
    courses={[{ id: 'course', name: 'Financial Fundamentals 3321-6 Accounting & Fin Fun' }]}
    folders={[{ id: 'section', name: 'Class Contribution', parent_course_id: 'course' }]}
    chats={[{ id: 'chat', title: 'Help me get started on Class Contribution', projectId: 'course', sectionFolderId: 'section' }]}
    activeId="chat" onCourse={() => {}} onSection={() => {}} onChat={() => {}} />);
  const course = html.indexOf('Financial Fundamentals');
  const section = html.indexOf('Class Contribution', course);
  const chat = html.indexOf('Help me get started on Class Contribution');
  expect(course).toBeGreaterThan(0);
  expect(section).toBeGreaterThan(course);
  expect(chat).toBeGreaterThan(section);
  expect(html).toContain('aria-current="page"');
});
