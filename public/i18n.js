import {normalizeLanguage,translate} from '../i18n-core.mjs';
export function getLanguage(){
 if(typeof window==='undefined')return 'hu';
 try{return normalizeLanguage(localStorage.getItem('earia.language'));}catch{return 'en';}
}
export function getLocale(){return getLanguage()==='hu'?'hu-HU':'en-US';}
export function t(text){return translate(text,getLanguage());}
export function setLanguage(language){
 const next=normalizeLanguage(language);
 try{localStorage.setItem('earia.language',next);}catch{}
 document.documentElement.lang=next;
 return next;
}
