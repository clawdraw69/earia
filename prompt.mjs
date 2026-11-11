import {t as tr} from "./i18n.mjs";
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';

const MAX_CHARS=40000;
const FALLBACK=`Magyar nyelven, természetesen fogalmazó szerepjáték-mesélő vagy. A játékoshoz második személyben beszélj, a játékos nevében ne dönts. A jelenet lépjen előre, ne ismételd a játékos cselekvését. Minden főszereplő felnőtt.`;
let cache={signature:'',text:'',hash:''};

// The rules file can be edited during play; reread it only when its modification time
// HU: A szabályfájl szerkeszthető a játék alatt; mtime+szerint csak akkor olvassuk
// or size changes. HTML comments are not sent to the model.
// HU: újra, ha tényleg változott. HTML-megjegyzés nem kerül a modellhez.
export function loadRules(file){
 try{
  const stat=statSync(file);
  const signature=`${file}:${stat.mtimeMs}:${stat.size}`;
  if(cache.signature===signature)return cache;
  const raw=readFileSync(file,'utf8').replace(/<!--[\s\S]*?-->/g,'').trim().slice(0,MAX_CHARS);
  const text=raw||FALLBACK;
  cache={signature,text,hash:createHash('sha256').update(text).digest('hex').slice(0,12)};
  return cache;
 }catch{return {signature:'',text:FALLBACK,hash:'fallback',missing:true};}
}
// Remove one ## section (for example when adult tone is disabled).
// HU: Egy ## szakasz kihagyása (például kikapcsolt felnőtt hangnem).
export function dropSection(text,title){
 const wanted=String(title).trim().toLowerCase();
 const out=[];
 let skipping=false;
 for(const line of text.split('\n')){
  const heading=/^##\s+(.*)$/.exec(line);
  if(heading)skipping=heading[1].trim().toLowerCase().startsWith(wanted);
  if(!skipping)out.push(line);
 }
 return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
// The data contract belongs to the program and cannot be overridden by the rules file.
// HU: A gépies szerződés mindig a programé: a szabályfájl nem írhatja felül.
const CONTRACT=`ADATÁTADÁS
Mindig a megadott sémának megfelelő JSON objektumot adj, más szöveget ne. A program számol és kezeli a naptárt. A narráció speaker értéke narrator. A helyszín nem változtatja meg a karakter klánját vagy kultúráját. A nem idézőjeles játékosi gondolat nem hallható az NPC-knek. Az NPC csak a saját tudását használhatja. Minden NPC kimondott mondata saját messages elembe kerüljön az NPC pontos id értékével. A karakterek neve nem azonos az id értékével. A játékos nevében nem adhatsz választ: a messages speaker értéke soha nem a játékos azonosítója és nem karakter név, hanem „narrator” vagy a felsorolt NPC id valamelyike. A titkos történettervet és a privateUpdate mezőt nem idézheted a látható üzenetekben. Minden főszereplő felnőtt. A Jégkarom a hegycsúcsi jégbarlang, a Kehely a lakóbarlang mélyén van: két külön helyszín.`;

export function buildSystem(world,rules,{adultTone=true}={}){
 let body=String(rules||'').trim();
 if(!adultTone)body=dropSection(body,tr('Felnőtt hangnem'));
 return `${tr("VILÁGADATOK\n")}${JSON.stringify(world)}\n\n${body}\n\n${tr(CONTRACT)}`;
}
