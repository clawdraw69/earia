import {mentionedCharacters} from './ooc.mjs';
import {LABELS,calendar,ranges} from './rules.mjs';

const species={Ursa:'medve',Wulf:'farkas',Taur:'bika',Lio:'oroszlán',Vulpi:'róka'};

// Send the meaning alongside the number. In Hungarian "farok" is ambiguous:
// this stat is NOT the animal tail, and must not create an anatomical feature.
export function narratorCharacter(c,playerId){
 const labels=[...LABELS[c.sex]];
 if(c.sex==='male')labels[2]='Nemi szerv mérete (nem az állati farok hossza)';
 const arousalLabel = (value) => {
  const n = Math.max(1, Math.min(7, Math.round(Number(value) || 1)));
  return ['száraz, nyugodt','ébredező, de még száraz','enyhén nedves','nedves','csöpögő','ömlő','túlcsorduló'][n-1];
 };
 const desireDescriptions = {
   1: 'teljesen kielégült, mély nyugalom',
   2: 'semleges, nyugodt',
   3: 'normál vágy',
   4: 'fokozott vágy',
   5: 'erős vágy',
   6: 'izzó vágy',
   7: 'mindent elsöprő vágy'
 };
 const vf = Number.isFinite(c.state?.vf) ? c.state.vf : 0;
 const vn = Number.isFinite(c.state?.vn) ? c.state.vn : 0;
 const activeSeeking = (vf >= 6 || vn >= 6);
 const seekingDirection = vf > vn ? 'férfiak felé' : (vn > vf ? 'nők felé' : 'mindkét nem felé');
const rs=ranges(c.clan,c.sex);
 const describeRelative=(value,min,max)=>{
   if(value<min) return 'a klánjához képest szerény, kisebb';
   if(value>max) return 'a klánjához képest nagy, dús, tekintélyes';
   if(value===min) return 'a klánjában átlagos, arányos';
   if(value===max) return 'a klánjában hangsúlyos, nagy';
   return 'a klánjában telt, gömbölyű';
 };
 const attributes=Object.fromEntries(labels.map((label,i)=>{
   const [min,max]=rs[i];
   return [label,{value:c.stats[i],scale:'1–7',meaning:describeRelative(c.stats[i],min,max)}];
 }));
 return {
  id:c.id,name:c.name,role:c.id===playerId?'játékoskarakter, hozzá beszélj második személyben':'fő NPC',age:c.age,clan:c.clan,sex:c.sex,
  appearance:{form:c.sex==='female'?'emberi nő, állati jegyek nélkül':`antropomorf ${species[c.clan]??'ismeretlen faj'}, emberi értelemmel`,build:attributes['Teltség'].meaning,authorDescription:c.description||'Nincs külön megadva.',unknown:'A nem rögzített egyedi jegyek (például szemszín, bundaszín, hegek, frizura) ismeretlenek. Nem szabad kitalálni őket. A teltség nem az izomzat mértéke.'},
  appearanceOverrideRule:'Az appearanceFacts és knowledgeFacts későbbi szerzői javítás: felülírja a régebbi authorDescription ellentétes részleteit.',appearanceFacts:c.appearanceFacts||{},knowledgeFacts:c.knowledgeFacts||[],relationshipNotes:c.relationshipNotes||'',attributes,orientation:c.orientation,blessings:c.blessings,
  state: {
    ...c.state,
    vfDescription: desireDescriptions[Math.round(vf)] || 'ismeretlen',
    vnDescription: desireDescriptions[Math.round(vn)] || 'ismeretlen',
    arousal: arousalLabel(Math.max(vf, vn)),
    activeSeeking,
    seekingDirection
  }
 };
}
export function narratorCharacters(game){return game.characters.map(c=>narratorCharacter(c,game.playerId));}
export function isAppearanceRequest(text,characters=[]){
 // A karakterlapot kikapcsoljuk, minden leírást a modell generál.
 return false;
}
function isDescriptionRefinement(text){
 const query=String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/[.!?]+$/,'').trim();
 return /^(?:(?:meg|kicsit|sokkal|ennel|kerlek)\s+)*(?:reszletesebben|bovebben|hosszabban|pontosabban|kulon-kulon)(?:\s+kerlek)?$/.test(query)
  || /^(?:folytasd a leirast|ne ilyen roviden|tobb reszletet(?: kerek)?)$/.test(query);
}
function previousAppearanceRequest(game){
 for(const message of [...game.messages].reverse()){
  if(message.speaker!==game.playerId&&message.speaker!=='ooc')continue;
  if(message.contextKind==='appearance'&&typeof message.appearanceRequest==='string')return message.appearanceRequest;
  if(isAppearanceRequest(message.text,game.characters))return message.text;
  if(!isDescriptionRefinement(message.text))return null;
 }
 return null;
}
export function narratorTurn(game,text,ooc=false){
 const direct=isAppearanceRequest(text,game.characters);
 const appearanceRequest=direct?text:isDescriptionRefinement(text)?previousAppearanceRequest(game):null;
 const appearanceOnly=Boolean(appearanceRequest);
 const detailed=appearanceOnly&&(!direct||/reszletes|bovebb/.test(String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()));
 if(appearanceOnly)return {appearanceOnly,appearanceRequest,detailed};
 return {appearanceOnly,prompt:`ELSŐBBSÉGI SZERZŐI JAVÍTÁSOK: ${JSON.stringify(game.adminState?.canon||[])}. Ezek minden korábbi narrációt felülírnak. A setup a kezdéskori kapcsolatokat tartalmazza, későbbi események változtathatnak rajtuk. A coreFacts szerzői tények. Az emlékek, összefoglaló és privát terv AI-feljegyzések: nem írhatják felül a karakterlapot, a szerzői tényeket és a játékos döntéseit.\nJátékállapot: ${JSON.stringify({playerId:game.playerId,characters:narratorCharacters(game),setup:game.setup,coreFacts:game.coreFacts||[],calendar:calendar(game.minutes),location:game.location,summary:game.summary,memories:game.memories.filter(m=>typeof m==='string'&&m.trim()).slice(-25),privateStory:ooc?undefined:game.privateStory,scene:game.scene})}\nElőzmények: ${JSON.stringify(game.messages.slice(game.adminState?.historyFrom||0).slice(-16))}\nÚj ${ooc?'mesélőhöz szóló, történeten kívüli':'játékosi'} üzenet: ${text}${turnLength(ooc)}`};
}
export function characterAppearance(game,request,detailed=false){
 const normalize=text=>String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const words=new Set(normalize(request).match(/[a-z0-9]+/g)||[]);
 let selected=mentionedCharacters(game,request);
 if(!selected.length)selected=game.characters.filter(c=>words.has(c.clan.toLowerCase())||words.has(species[c.clan]));
 if(!selected.length)selected=/\b(?:karakterem|kulsom|nezek|magam)\b/.test(normalize(request))?game.characters.filter(c=>c.id===game.playerId):game.characters;
 const builds=['Testalkata vékony, karcsú.','Testalkata átlagos.','Testalkata telt, gömbölyded.','Testalkata kövérkés.','Testalkata nagy, masszív és kövér.'];
 const paragraphs=selected.map(c=>{
  const form=c.sex==='female'?'emberi nő':species[c.clan]?`antropomorf ${species[c.clan]}férfi`:'antropomorf férfi';
  const known=`${c.name}: ${c.age} éves ${form}. ${builds[Math.min(4,Math.floor((c.stats[0]-1)*4/6))]}`;
  const description=String(c.description||'').trim();
  const labels={eyeColor:'Szemszín',furColor:'Bundaszín',hairColor:'Hajszín',heightCm:'Testmagasság (cm)',appearanceNotes:'Külső jegyek'};
  const facts=Object.entries(c.appearanceFacts||{}).map(([k,v])=>`${labels[k]||k}: ${v}.`).join(' ');
  return known+(facts?'\n'+facts:'')+(description?`\nSzerzői leírás${c.appearanceOverrides?.length?' (az eltérő régi külső jegyeket a fenti javított adatok felülírják)':''}: ${description}`:detailed?' Külön szerzői külső leírás nincs rögzítve.':'');
 });
 if(detailed){
  if(selected.every(c=>!String(c.description||'').trim()&&!Object.keys(c.appearanceFacts||{}).length)){
   paragraphs.push('Szemszín, ruházat, testmagasság, hegek és más egyedi külső jegyek nincsenek megadva. Az izomzat mértékéről sincs külön adat; a teltség nem az izomzat mértéke.');
   if(selected.some(c=>c.sex==='male'))paragraphs.push('A férfikarakterek bundaszíne és állati farkának hossza nincs rögzítve.');
  }else paragraphs.push('A szerzői leírásban és az adatlapokon nem rögzített külső jegyek ismeretlenek.');
 }
 return 'Karakterlap — rögzített adatok\n\n'+paragraphs.join('\n\n');
}
// Felnőtt hangnem: a játék saját utasításai. Nem a szolgáltató szűrőjének
// megkerülése, hanem a moralizálás és a jelenet elsietésének kizárása.
const ADULT=`FELNŐTT HANGNEM
Ez felnőtteknek szóló fantasy; minden szereplő felnőtt. A vonzalom, a vágy és a testi közelség a történet természetes része, nem hiba és nem mellékes díszlet.
A mesélő nem fűz a szöveghez erkölcsi magyarázatot, figyelmeztetést vagy bocsánatkérést, és nem beszél önmagáról. Nem dönt a játékos helyett.
A jelenet intenzitását a játékos lépései és a setup hangneme adják. Amit a játékos elkezd, azt a mesélő nem ugorja át, nem összegzi egy mondatban, és nem sötétíti el kéretlenül; a tempót a játékos lépéseihez igazítja. A testi eseményeket a rögzített karakteradatok és a korábbi jelenet tényei vezérlik.`;
const turnLength=ooc=>ooc?'\nVálaszolj röviden, 1–2 bekezdésben.':'\nTartsd be a HOSSZ ÉS FELÉPÍTÉS szakaszt; a párbeszédet a szereplő saját üzenetében add, és ne ismételd meg az előző kör szövegét.';

export {buildSystem as narratorSystem} from './prompt.mjs';
