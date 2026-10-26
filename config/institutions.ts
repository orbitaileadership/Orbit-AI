/** Schools shown in the sign-up picker. Listing a school is not an affiliation or SSO integration. `domains` are the school's
 *  student email domains (subdomains count too); students at any other school pick "My school isn't listed" and sign up
 *  with their school email (lib/auth/eligibility.ts). */
export const INSTITUTIONS = [
 {id:'western',name:'Western University',city:'London',aliases:'UWO Western',logo:'/institutions/western.png',login:true,domains:['uwo.ca']},
 {id:'toronto',name:'University of Toronto',city:'Toronto',aliases:'UofT U of T',logo:'/institutions/toronto.png',login:true,domains:['utoronto.ca']},
 {id:'waterloo',name:'University of Waterloo',city:'Waterloo',aliases:'UW',logo:'/institutions/waterloo.png',login:true,domains:['uwaterloo.ca']},
 {id:'mcmaster',name:'McMaster University',city:'Hamilton',aliases:'Mac',logo:'/institutions/mcmaster.png',login:true,domains:['mcmaster.ca']},
 {id:'queens',name:"Queen’s University",city:'Kingston',aliases:'Queens Queen\'s',logo:'/institutions/queens.png',login:true,domains:['queensu.ca']},
 {id:'ottawa',name:'University of Ottawa',city:'Ottawa',aliases:'uOttawa Université Ottawa',logo:'/institutions/ottawa.png',login:true,domains:['uottawa.ca']},
 {id:'york',name:'York University',city:'Toronto',aliases:'YorkU',logo:'/institutions/york.png',login:true,domains:['yorku.ca']},
 {id:'tmu',name:'Toronto Metropolitan University',city:'Toronto',aliases:'TMU Ryerson',logo:'/institutions/tmu.png',login:true,domains:['torontomu.ca','ryerson.ca']},
] as const;
export function institution(id:unknown){return INSTITUTIONS.find(s=>s.id===id);}

/** Does this email belong to the chosen school? Listed schools: their domains (and subdomains). "other": any school email. */
export function emailFitsInstitution(email: string, id: unknown, allowed: (email: string) => boolean): boolean {
  if (!allowed(email)) return false;
  if (id === 'other') return true;
  const school = institution(id);
  if (!school) return false;
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return school.domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// Canonical names come from config; only the manual option accepts a supplied name.
export function waitlistInstitution(id: unknown, rawName: unknown): string | null {
  const selected = institution(id);
  if (selected) return selected.name;
  if (id !== 'other' || typeof rawName !== 'string') return null;
  const name = rawName.trim().replace(/ +/g, ' ');
  if (name.length < 2 || name.length > 120 || /[\p{Cc}\p{Cf}<>]/u.test(name) || !/\p{L}/u.test(name)) return null;
  const known = INSTITUTIONS.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return known?.name ?? name;
}
