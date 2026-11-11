import {t as tr} from "./i18n.mjs";
import {randomUUID} from 'node:crypto';
export function validMessages(data,g,{ooc=false}={}){
 if(!Array.isArray(data?.messages)||!data.messages.length||data.messages.length>12)throw Error(tr('A mesélő válasza hiányos.'));
 const ids=new Set(['narrator',...g.characters.filter(c=>c.id!==g.playerId).map(c=>c.id)]);
 return data.messages.map(m=>{
  if(!m||!ids.has(m.speaker)||typeof m.text!=='string'||!m.text.trim()||m.text.length>12000)throw Error(tr('Hibás beszélő vagy szöveg a mesélőtől.'));
  return {id:randomUUID(),speaker:ooc?'system':m.speaker,...(ooc?{source:'ooc-answer'}:{}),text:m.text.trim()};
 });
}
export function appendNonempty(items,value,max){
 const text=typeof value==='string'?value.trim().slice(0,max):'';
 if(text&&!items.includes(text))items.push(text);
}
export function appendOocAnswer(g,data,text){
 const messages=validMessages(data,g,{ooc:true});
 g.messages.push({id:randomUUID(),speaker:'ooc',text},...messages);
}
