import { COURSE_WORKSPACE,QUIZ_FORMATS,type QuizFormat } from '@/config/course-workspace';
import type { Course,CourseItem } from './types';
import { parseWidget } from '@/lib/widgets/schema';
export type StudyConfig={format:QuizFormat;count:number;section_id:string;start_state:'ready'|'started'};
export type StudyCard={front:string;back:string};
export function studyConfig(raw:unknown):StudyConfig{
 if(!raw||typeof raw!=='object')throw new Error('invalid_quiz');const c=raw as StudyConfig;
 if(!QUIZ_FORMATS.includes(c.format)||!Number.isInteger(c.count)||c.count<1||c.count>COURSE_WORKSPACE.maxQuestions||typeof c.section_id!=='string'||!['ready','started'].includes(c.start_state))throw new Error('invalid_quiz');return {format:c.format,count:c.count,section_id:c.section_id,start_state:c.start_state};
}
export const quizLabel=(format:QuizFormat)=>format==='mcq'?'Multiple choice':format==='short-answer'?'Short answer':'Flashcards';
/** Shown in the chat and retained as the student's request. Detailed generation rules stay server-side. */
export function studyLaunchPrompt(course:Pick<Course,'name'>,item:CourseItem,config:StudyConfig){
 return `Create ${config.count} ${quizLabel(config.format).toLowerCase()} ${config.format==='flashcards'?'':'questions '}for ${item.title} in ${course.name}.`;
}
const CARD=/\[\[card:\s*(\{[^\n]*?\})\s*\]\]/g;
export function parseStudyCards(text:string){const cards:StudyCard[]=[];const clean=text.replace(CARD,(_,raw:string)=>{try{const c=JSON.parse(raw);if(typeof c.front==='string'&&typeof c.back==='string'&&c.front.trim()&&c.back.trim()&&c.front.length<=2000&&c.back.length<=4000&&cards.length<COURSE_WORKSPACE.maxCards)cards.push({front:c.front.trim(),back:c.back.trim()});}catch{}return '';});
 const blocks=[...clean.matchAll(/```(?:orbit-widget|json)\s*\n([\s\S]*?)\n```/gi)].map(match=>match[1]);
 if(!blocks.length)blocks.push(clean.trim());
 for(const block of blocks){const widget=parseWidget(block.trim());if(widget?.type==='flashcards')for(const card of widget.cards){if(cards.length<COURSE_WORKSPACE.maxCards)cards.push(card);}}
 return {clean,cards};}
export function hideStudyCards(text:string){return parseStudyCards(text).clean.replace(/\[\[card:[\s\S]*$/,'');}
export function cardsTsv(cards:StudyCard[]){return cards.map(c=>[c.front,c.back].map(s=>s.replace(/[\t\r\n]+/g,' ').replace(/ {2,}/g,' ').replace(/</g,'‹').replace(/>/g,'›')).join('\t')).join('\n');}

export function validStudyCards(raw:unknown):StudyCard[]{if(!Array.isArray(raw))return [];return raw.filter((c):c is StudyCard=>Boolean(c&&typeof c==='object'&&typeof c.front==='string'&&typeof c.back==='string'&&c.front.trim()&&c.back.trim()&&c.front.length<=2000&&c.back.length<=4000)).slice(0,COURSE_WORKSPACE.maxCards);}
