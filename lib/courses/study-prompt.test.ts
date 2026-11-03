import { expect,it } from 'vitest';
import { studyPrompt } from './study-prompt';
import type { CourseDraft,CourseItem } from './types';

const topic=(title:string):CourseItem=>({title,kind:'topic',details:'',due:null,weight:'',sourceId:null,status:'todo'});
const section:CourseItem={...topic('Midterm 2'),kind:'exam',details:'Cellular respiration and ATP synthesis'};
const config={format:'mcq' as const,count:10,section_id:'section',start_state:'ready' as const};

it('uses later section topics rather than filling its scope with the first syllabus entries',()=>{
 const course_data={items:[...Array.from({length:8},(_,i)=>topic('Early topic '+i)),topic('Cellular respiration')]} as CourseDraft;
 const prompt=studyPrompt({name:'Biology',course_data},section,config);
 expect(prompt).toContain('"topics":["Cellular respiration"]');
 expect(prompt).not.toContain('Early topic');
});

it('omits a topic map when its relationship to the selected section is unknown',()=>{
 const course_data={items:[topic('Genetics')]} as CourseDraft;
 expect(studyPrompt({name:'Biology',course_data},section,config)).not.toContain('"topics"');
});

it('does not treat common words or substrings as section-topic evidence',()=>{
 const course_data={items:[topic('Supply and demand'),topic('Cancellation policy')]} as CourseDraft;
 const prompt=studyPrompt({name:'Biology',course_data},{...section,details:'Cell and energy'},config);
 expect(prompt).not.toContain('"topics"');
});
