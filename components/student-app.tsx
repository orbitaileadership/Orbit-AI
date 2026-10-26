'use client';
import { useState } from 'react';
import { ChatApp } from '@/app/chat/chat-app';
import { CourseWorkspace } from './course-workspace';
import type { CourseLaunch } from '@/lib/courses/types';
export function StudentApp({email,userId,isAdmin=false}:{email:string;userId:string;isAdmin?:boolean}){
 const [courses,setCourses]=useState(false),[visited,setVisited]=useState(false),[launch,setLaunch]=useState<(CourseLaunch & {key:number})|null>(null);
 return <><div hidden={courses}><ChatApp isAdmin={isAdmin} email={email} userId={userId} onCourses={()=>{setVisited(true);setCourses(true);}} courseLaunch={launch}/></div>{visited&&<div hidden={!courses}><CourseWorkspace active={courses} userId={userId} onChat={()=>setCourses(false)} onLaunch={l=>{setLaunch({...l,key:Date.now()});setCourses(false);}}/></div>}</>;
}
