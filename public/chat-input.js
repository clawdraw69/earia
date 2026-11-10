export function isUppercaseOoc(text){
 const s=String(text).trim();
 return s!==s.toLocaleLowerCase('hu')&&s===s.toLocaleUpperCase('hu');
}
export function shouldSend(event){return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!event.repeat;}
