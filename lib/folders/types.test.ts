import { expect, it } from 'vitest';
import { folderSections, type Folder } from './types';
it('keeps pins separate and sorts recent folders by visits, falling back to creation/update',()=>{
 const folder=(id:string,last_opened_at:string|null,pinned_at:string|null=null):Folder=>({id,name:id,instructions:'',parent_course_id:null,pinned_at,last_opened_at,updated_at:'2026-10-18'});
 const sections=folderSections([folder('older','2026-10-17'),folder('pin','2026-10-19','2026-10-16'),folder('new',null),folder('visited','2026-10-19')]);
 expect(sections.pinned.map(f=>f.id)).toEqual(['pin']);
 expect(sections.recent.map(f=>f.id)).toEqual(['visited','new','older']);
});
