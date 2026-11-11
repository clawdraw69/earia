import english from './locales/en.mjs';

export function normalizeLanguage(value, fallback='en') {
 return /^hu(?:-|$)/i.test(String(value||''))?'hu':/^en(?:-|$)/i.test(String(value||''))?'en':fallback;
}
export function translate(text,language='en') {
 if(typeof text!=='string'||language==='hu')return text;
 return Object.hasOwn(english,text)?english[text]:text;
}
