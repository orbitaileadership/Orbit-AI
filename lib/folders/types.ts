export type Folder = {
  id: string;
  name: string;
  instructions: string;
  parent_course_id: string | null;
  pinned_at: string | null;
  last_opened_at: string | null;
  updated_at: string;
};
export const FOLDER_COLUMNS = 'id,name,instructions,parent_course_id,pinned_at,last_opened_at,updated_at';
export function folderSections(folders: Folder[]) {
  return {
    pinned: folders.filter(f => f.pinned_at).sort((a,b) => b.pinned_at!.localeCompare(a.pinned_at!)),
    recent: folders.filter(f => !f.pinned_at).sort((a,b) => (b.last_opened_at ?? b.updated_at).localeCompare(a.last_opened_at ?? a.updated_at)),
  };
}
