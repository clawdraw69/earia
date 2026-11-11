import {t as tr} from "./i18n.mjs";
import {randomUUID} from 'node:crypto';
export const normalize=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const aliases=c=>[normalize(c.name.split('·')[0].trim())];
export function mentionedCharacters(game,text){const q=normalize(text);return game.characters.filter(c=>aliases(c).some(name=>new RegExp('\\b'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:nak|nek|ot|et|at|t|rol|tol|val|vel|re|ra|ban|ben)?\\b').test(q)));}
export function isOocCorrection(text){const q=normalize(text);return /\b(?:legyen|mostantol|javits\w*|korrigal\w*|helyesbit\w*|modosits\w*|ird at|teves\w*|hibas\w*|valojaban|nem ismeri|nem talalkozott|torold\w*|felejtsd el)\b/.test(q);}
const emptyPlan=()=>({clarification:'',characterEdits:[],knowledgeEdits:[],canon:[],summary:null,memories:null,privateStoryJson:null,location:null,minutes:null});
export function directOocPlan(game,text){
 if(/\?|\b(?:milyen|mennyi|vajon)\b/.test(normalize(text)))return null;
 const q=normalize(text),named=mentionedCharacters(game,text),plan=emptyPlan();
 const colors={arany:tr('aranyszínű'),kek:tr('kék'),barna:tr('barna'),zold:tr('zöld'),szurke:tr('szürke'),fekete:tr('fekete'),feher:tr('fehér'),voros:tr('vörös'),lila:'lila',ezust:tr('ezüstszínű')};
 const found=[...q.matchAll(/\b(arany|kek|barna|zold|szurke|fekete|feher|voros|lila|ezust)(?:szinu)?(?:szemu)?\b/g)];
 if(named.length===1&&found.length===1&&/szem/.test(q)&&! /\b(?:nem|ne|es|illetve)\b|bunda|haj/.test(q)&&q.length<180){plan.characterEdits.push({id:named[0].id,field:'eyeColor',value:colors[found[0][1]]});return plan;}
 const knowledge=q.match(/\b(?:meg )?nem ismeri\s+(.+?)[.!?]?$/);
 if(knowledge&&named.length>=1&&q.length<220&&!/[;,]|\b(?:es|de|hanem|illetve)\b/.test(q)){
  const subject=named.find(c=>aliases(c).some(n=>q.startsWith(n)));
  if(subject){const others=named.filter(c=>c.id!==subject.id);if(others.length<=1){plan.knowledgeEdits.push({id:subject.id,person:others[0]?.name||text.slice(knowledge.index+knowledge[0].indexOf(knowledge[1])).replace(/[.!?]+$/,'').trim(),known:false,statement:text});return plan;}}
 }
 return null;
}
export function oocSchema(game){
 const str={type:'string',maxLength:4000},nullable={anyOf:[str,{type:'null'}]};
 const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 const id={type:'string',enum:game.characters.map(c=>c.id)};
 return obj({clarification:{type:'string',maxLength:500},characterEdits:{type:'array',maxItems:24,items:obj({id,field:{type:'string',enum:['name','age','description','eyeColor','furColor','hairColor','heightCm','appearanceNotes','relationshipNotes','stats']},value:str})},knowledgeEdits:{type:'array',maxItems:24,items:obj({id,person:{type:'string',maxLength:100},known:{type:'boolean'},statement:str})},canon:{type:'array',maxItems:24,items:obj({key:{type:'string',maxLength:120},text:str})},summary:nullable,memories:{anyOf:[{type:'array',maxItems:200,items:str},{type:'null'}]},privateStoryJson:nullable,location:nullable,minutes:{anyOf:[{type:'integer',minimum:0,maximum:52560000},{type:'null'}]}});
}
export const OOC_SYSTEM=`A játékos OOC utasítása szerzői, elsőbbségi javítás. Nem mesélsz, hanem minimális, pontos állapotjavítási tervet készítesz a JSON-séma szerint. Csak a játékos által kért javításokat végezd, ne találj ki új tényt. A nem módosítandó summary/memories/privateStoryJson/location/minutes mező null. A characterEdits csak a megadott azonosítóval dolgozhat; a value szöveg, stats esetén hét számból álló JSON-lista. A szemszín eyeColor, a bundaszín furColor. A knowledgeEdits rögzíti, kit ismer vagy nem ismer egy karakter. A canon tartós szerzői tények listája; meglévő tény módosításakor ugyanazt a key-t használd. Javítsd a kéréssel ellentétes összefoglalót, emlékeket és titkos tervrészeket is, de az összes többi érvényes tényt őrizd meg. A privateStoryJson a teljes új privát történetobjektum JSON szövege, csak ha módosítandó. A nyilvános válaszban ne idézz titkos tervet. Ha nem egyértelmű, mi legyen a helyes állapot, clarification mezőben kérdezz vissza, és minden módosítási lista legyen üres. Puszta lekérdezést ne módosításként értelmezz. A séma minden mezőjét add vissza.`;
function character(game,id){const c=game.characters.find(c=>c.id===id);if(!c)throw Error(tr('Az OOC ismeretlen karaktert módosítana.'));return c;}
function checkedText(value,max=4000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(tr('Hibás vagy túl hosszú OOC-érték.'));return value.trim();}
// Keep an old, affected sentence out of active context without deleting the transcript.
function scrub(value,subjects,terms){
 if(typeof value==='string')return value.split(/(?<=[.!?])\s+|\n+/).filter(sentence=>{const q=normalize(sentence);return !(subjects.some(n=>q.includes(n))&&terms.some(t=>q.includes(t)));}).join(' ').trim();
 if(Array.isArray(value))return value.map(x=>scrub(x,subjects,terms)).filter(x=>x!=='');
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v,subjects,terms)]));
 return value;
}
export function applyOocPlan(original,text,plan){
 if(plan.clarification?.trim())throw Error(tr('OOC pontosítás szükséges: ')+plan.clarification.trim());
 const next=structuredClone(original),changes=[],canonical=[];
 for(const key of ['characterEdits','knowledgeEdits','canon'])if(!Array.isArray(plan[key])||plan[key].length>24)throw Error(tr('Hibás OOC-módosításlista.'));
 const named=mentionedCharacters(original,text),allowed=new Set(named.map(c=>c.id));
 const checkTarget=id=>{if(allowed.size&&!allowed.has(id)&&! /minden|osszes/.test(normalize(text)))throw Error(tr('Az OOC a megnevezetten kívüli karaktert is módosítaná.'));return character(next,id);};
 const cleanup=(c,terms)=>{
  const subjects=aliases(c);
  next.summary=scrub(next.summary,subjects,terms);next.memories=scrub(next.memories||[],subjects,terms);next.privateStory=scrub(next.privateStory||{},subjects,terms);
 };
 for(const edit of plan.characterEdits){
  const c=checkTarget(edit.id),value=checkedText(edit.value),key='character:'+c.id+':'+edit.field;
  if(['eyeColor','furColor','hairColor','heightCm','appearanceNotes'].includes(edit.field)){
   let v=value;if(edit.field==='heightCm'){v=Number(value);if(!Number.isFinite(v)||v<30||v>1000)throw Error(tr('Érvénytelen testmagasság.'));}
   c.appearanceFacts={...(c.appearanceFacts||{}),[edit.field]:v};
   const terms={eyeColor:['szem'],furColor:['bunda','szorzet'],hairColor:['haj'],heightCm:['magassag','centimeter'],appearanceNotes:['kulso']}[edit.field];
   cleanup(c,terms);
   // Keep author text intact; structured corrections explicitly override it.
   c.appearanceOverrides=[...new Set([...(c.appearanceOverrides||[]),edit.field])];
   const label={eyeColor:tr('szemszín'),furColor:tr('bundaszín'),hairColor:tr('hajszín'),heightCm:tr('testmagasság (cm)'),appearanceNotes:tr('külső leírás')}[edit.field];
   changes.push(`${c.name} – ${label}: ${v}.`);canonical.push({key,text:`${c.name}: ${label} = ${v}.`});
  }else if(edit.field==='description'){c.description=value;changes.push(c.name+tr(' szerzői leírása frissítve.'));canonical.push({key,text:c.name+tr(' szerzői leírása: ')+value});}
  else if(edit.field==='relationshipNotes'){c.relationshipNotes=value;cleanup(c,['barat','rokon','ismer','talalk','kapcsolat']);changes.push(c.name+tr(' kapcsolati adatai frissítve.'));canonical.push({key,text:c.name+': '+value});}
  else if(edit.field==='name'){if(value.length>60)throw Error(tr('Túl hosszú név.'));c.name=value;changes.push(tr('Karakternév módosítva: ')+value);canonical.push({key,text:'A karakter neve: '+value});}
  else if(edit.field==='age'){const age=Number(value);if(!Number.isInteger(age)||age<18||age>200)throw Error(tr('Érvénytelen felnőtt életkor.'));c.age=age;changes.push(`${c.name}${tr(" életkora: ")}${age}.`);canonical.push({key,text:`${c.name} ${age}${tr(" éves.")}`});}
  else if(edit.field==='stats'){const stats=JSON.parse(value);if(!Array.isArray(stats)||stats.length!==7||stats.some(v=>!Number.isInteger(v)||v<1||v>7))throw Error(tr('Hét darab 1–7 közötti egész tulajdonságérték kell.'));c.stats=stats;c.unspent=0;changes.push(c.name+tr(' tulajdonságértékei módosítva (OOC).'));canonical.push({key,text:c.name+tr(' tulajdonságértékei: ')+value});}
  else throw Error(tr('Nem támogatott OOC-karaktermező.'));
 }
 for(const edit of plan.knowledgeEdits){
  const c=checkTarget(edit.id),person=checkedText(edit.person,100),statement=checkedText(edit.statement);
  if(typeof edit.known!=='boolean')throw Error(tr('Hibás ismeretségi állapot.'));
  c.knowledgeFacts=(c.knowledgeFacts||[]).filter(f=>normalize(f.person)!==normalize(person));c.knowledgeFacts.push({person,known:edit.known,statement});
  const oldSubjects=aliases(c),other=mentionedCharacters(next,person).flatMap(aliases);const terms=other.length?other:[normalize(person)];
  next.summary=scrub(next.summary,oldSubjects,terms);next.memories=scrub(next.memories||[],oldSubjects,terms);next.privateStory=scrub(next.privateStory||{},oldSubjects,terms);
  // Preserve unrelated traits in the author's original description.
  const key='knowledge:'+c.id+':'+normalize(person);canonical.push({key,text:statement});changes.push(`${c.name}${tr(" ismeretségi adata rögzítve: ")}${statement}`);
 }
 for(const fact of plan.canon){canonical.push({key:checkedText(fact.key,120),text:checkedText(fact.text)});changes.push(tr('Tartós szerzői tény: ')+fact.text);}
 if(plan.summary!==null){next.summary=typeof plan.summary==='string'&&plan.summary.length<=4000?plan.summary.trim():checkedText(plan.summary);changes.push(tr('Történeti összefoglaló javítva.'));}
 if(plan.memories!==null){if(!Array.isArray(plan.memories)||plan.memories.length>200)throw Error(tr('Hibás emléklista.'));next.memories=plan.memories.map(x=>checkedText(x));changes.push(tr('Aktív emléklista javítva.'));}
 if(plan.privateStoryJson!==null){const parsed=JSON.parse(checkedText(plan.privateStoryJson,20000));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error(tr('Hibás háttértörténet.'));next.privateStory=parsed;changes.push(tr('Privát történetterv javítva.'));}
 if(plan.location!==null){next.location=checkedText(plan.location,120);changes.push(tr('Helyszín: ')+next.location);}
 if(plan.minutes!==null){if(!Number.isInteger(plan.minutes)||plan.minutes<0||plan.minutes>52560000)throw Error(tr('Hibás játékidő.'));next.minutes=plan.minutes;changes.push(tr('Játékidő módosítva.'));}
 if(!changes.length)throw Error(tr('Nem találtam végrehajtható OOC-módosítást. Pontosítsd, mi legyen a helyes állapot.'));
 const oldState=next.adminState||{},canon=new Map((oldState.canon||[]).map(f=>[f.key,f]));
 for(const fact of canonical)canon.set(fact.key,fact);
 if(!canonical.length)canonical.push({key:'instruction:'+randomUUID(),text});
 for(const fact of canonical)canon.set(fact.key,fact);
 next.adminState={...oldState,revision:(oldState.revision||0)+1,canon:[...canon.values()],historyFrom:next.messages.length,updatedAt:new Date().toISOString()};
 next.choices=[];next.pendingEvents=[];next.candidate=null;
 return {game:next,changes,id:randomUUID()};
}
