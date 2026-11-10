export const API_DEFAULTS={provider:'local',apiBaseUrl:'https://api.deepseek.com',apiModel:'deepseek-flash',apiKeyEncrypted:'',narrationTemperature:0.85,adultTone:true};
// A szolgáltató oldali tartalmi döntést a játék nem tudja felülírni. Ezért a
// szűrt vagy elutasított válasz külön, érthető hibaüzenetet kap, nem JSON-hibát.
const REFUSAL=/^\s*(?:sajn[aá]lom|bocs[aá]nat|nem tudok|nem [aá]ll módomban|nem seg[ií]thetek|nem [ií]rhatok|ezt nem (?:tudom|lehet)|nem tudom (?:teljes[ií]teni|meg[ií]rni))/i;
const REFUSAL_IN_TEXT=/(?:sajn[aá]lom|bocs[aá]nat)[^.!?]{0,80}(?:nem tud|nem [aá]ll|nem seg[ií]thet)|nem tudok (?:ilyen|ebben|ezzel)[^.!?]{0,40}(?:seg[ií]teni|tartalmat)|nem [aá]ll módomban[^.!?]{0,40}(?:teljes[ií]teni|meg[ií]rni|ilyen)/i;
export function publicConfig(config){const {apiKeyEncrypted,apiKey,...safe}=config;return {...safe,hasApiKey:Boolean(apiKeyEncrypted)};}
export function apiBase(value){
 let url;try{url=new URL(value);}catch{throw Error('Érvénytelen API-alapcím.');}
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('HTTPS API-cím kell (helyben HTTP is használható), kulcs és paraméterek nélkül.');
 if(/\/chat\/completions\/?$/.test(url.pathname))throw Error('Az API alapcímét add meg, a /chat/completions végződés nélkül.');
 return url.href.replace(/\/+$/,'');
}
// Validate the subset of JSON Schema used by this game, independently of the provider.
// A hibaüzenet megnevezi a hibás mezőt, hogy a javító újrapróbálkozás tudja, mit javítson.
export function validateOutput(value,schema,path='$'){
 const invalid=detail=>{throw Error(`Az API válasza nem felel meg a játék adatsémájának${detail?` (${detail})`:''}. A mentés változatlan.`);};
 if(schema.anyOf){if(!schema.anyOf.some(s=>{try{validateOutput(value,s,path);return true;}catch{return false;}}))invalid(`${path}: egyik engedett forma sem illik`);return;}
 if(schema.enum&&!schema.enum.includes(value))invalid(`${path}: nem engedett érték`);
 if(schema.type==='null'){if(value!==null)invalid(`${path}: null kell`);return;}
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(`${path}: objektum kell`);
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))invalid(`${path}.${key} hiányzik`);
  for(const [key,v] of Object.entries(value)){if(schema.properties?.[key])validateOutput(v,schema.properties[key],`${path}.${key}`);else if(schema.additionalProperties===false)invalid(`${path}.${key} nem engedett mező`);}
 }else if(schema.type==='array'){
  if(!Array.isArray(value)||value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))invalid(`${path}: ${schema.minItems??0}–${schema.maxItems??'∞'} elem kell`);
  value.forEach((v,i)=>validateOutput(v,schema.items,`${path}[${i}]`));
 }else if(schema.type==='string'){if(typeof value!=='string'||value.length>(schema.maxLength??Infinity))invalid(`${path}: szöveg kell${schema.maxLength?` (max ${schema.maxLength} karakter)`:''}`);}
 else if(schema.type==='boolean'){if(typeof value!=='boolean')invalid(`${path}: logikai érték kell`);}
 else if(['integer','number'].includes(schema.type)){if(typeof value!=='number'||!Number.isFinite(value)||schema.type==='integer'&&!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))invalid(`${path}: ${schema.minimum??''}–${schema.maximum??''} közötti ${schema.type==='integer'?'egész':'szám'} kell`);}
}
function apiError(status){return Error(({401:'Hibás vagy lejárt API-kulcs.',402:'Az API-egyenleg elfogyott.',403:'Az API-hozzáférés tiltott.',404:'Az API-cím vagy modell nem található.',429:'Az API kérési korlátját elérted; próbáld később.'})[status]||`API-hiba (HTTP ${status}). Ellenőrizd a címet, modellt és a JSON-mód támogatását.`);}
async function request(config,key,resource,body,fetcher){
 if(!key)throw Error('Add meg az API-kulcsot a Beállításokban.');
 let response;try{response=await fetcher(apiBase(config.apiBaseUrl)+resource,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(300000)});}catch{throw Error('Az API nem érhető el, vagy lejárt a várakozási idő. A mentés változatlan.');}
 if(!response.ok)throw apiError(response.status);
 try{return await response.json();}catch{throw Error('Az API nem JSON választ küldött.');}
}
// A szolgáltatói tartalmi döntés nem megkerülhető innen; a cél a pontos hibaüzenet
// és az, hogy a játék ne a JSON-hibára gyanakodjon.
function replyProblem(choice,host){
 const finish=choice?.finish_reason;
 if(finish==='content_filter')return Error(`A szolgáltató (${host}) tartalmi szűrője megszakította a választ. Ez nem a játék szabályain múlik, és innen nem írható felül; a mentés változatlan.`);
 const raw=choice?.message?.content;
 if(typeof raw!=='string'||!raw.trim())return Error(`Az API üres választ adott${finish?` (${finish})`:''}. A mentés változatlan; próbáld újra, vagy rövidebb jelenettel.`);
 if(REFUSAL.test(raw))return Error(`A modell szövegesen elutasította a kérést, ezért nincs feldolgozható válasz. Ez a szolgáltató (${host}) oldalán dől el, nem a játék szabályain; a mentés változatlan.`);
 return null;
}
// A modell néha kódblokkot, felvezető szöveget, szétesett szótöredékeket vagy
// félbeszakadt, majd újraindított JSON-t ad. Nyers JSON.parse hibaüzenet soha nem
// juthat el a felhasználóhoz.
function jsonOf(text){
 const raw=String(text??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const attempts=[raw];
 const markers=[...raw.matchAll(/<[^<>]{0,40}thinking[^<>]{0,40}>/gi)];
 if(markers.length)attempts.push(raw.slice(markers.at(-1).index+markers.at(-1)[0].length));
 const restarts=[...raw.matchAll(/\{\s*"messages"/g)];
 if(restarts.length)attempts.push(raw.slice(restarts.at(-1).index));
 const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(start>=0&&end>start)attempts.push(raw.slice(start,end+1));
 for(const attempt of attempts){try{return JSON.parse(attempt.trim());}catch{}}
 throw Error('Az API nem adott feldolgozható JSON választ (a válasz hibás vagy hiányos volt). A mentés változatlan; próbáld újra, és ha ismétlődik, csökkentsd a mesélői hőfokot.');
}
export async function remoteInfer(config,key,system,user,schema,{fetcher=fetch,temperature=config.narrationTemperature??API_DEFAULTS.narrationTemperature,maxTokens=8192}={}){
 const host=new URL(config.apiBaseUrl).hostname;
 async function once(note,temp=temperature){
  const body={model:config.apiModel,messages:[{role:'system',content:system+(note?`\nJAVÍTÁS: ${note}`:'')},{role:'user',content:user+'\n\nKizárólag JSON objektumot adj. A kötelező JSON-séma: '+JSON.stringify(schema)}],temperature:temp,max_tokens:maxTokens,response_format:{type:'json_object'},stream:false};
  if(host==='api.deepseek.com')body.thinking={type:'disabled'};
  const result=await request(config,key,'/chat/completions',body,fetcher);return result.choices?.[0];
 }
 function parse(choice){
  if(choice?.finish_reason==='length')throw Error('Az API válasza elérte a hosszkorlátot. A mentés változatlan.');
  const problem=replyProblem(choice,host);if(problem)throw problem;
  const parsed=jsonOf(choice.message.content);
  // A modell néha a játékos beszélőjeként vagy karakternévvel ír üzenetet. Az ilyen
  // elem kiesik; a többi jelenet megmarad, nem veszik el a kör.
  const allowed=schema?.properties?.messages?.items?.properties?.speaker?.enum;
  if(Array.isArray(allowed)&&Array.isArray(parsed?.messages)){
   const kept=parsed.messages.filter(m=>m&&allowed.includes(m.speaker));
   if(kept.length&&kept.length<parsed.messages.length)parsed.messages=kept;
  }
  // A modell hosszú magyar JSON-nál néha szétesik: idegen karakterek, kevert nyelv.
  // Ilyenkor alacsonyabb hőfokú újrapróbálkozás jön, nem kerül a mentésbe.
  const junk=/[ığşçÃÂÀèìòù]|\bthinking\b/i;
  if(Array.isArray(parsed?.messages)&&parsed.messages.some(m=>typeof m?.text==='string'&&junk.test(m.text)))throw Error('A modell válasza szétesett (idegen karakterek vagy kevert nyelv). A mentés változatlan.');
  // JSON-módban az elutasítás néha narrációként csúszik be; ezt ne mentse el a játék.
  const first=parsed?.messages?.[0];
  if(first&&first.speaker==='narrator'&&typeof first.text==='string'&&first.text.length<400&&REFUSAL_IN_TEXT.test(first.text))throw Error(`A modell a jelenet helyett elutasító megjegyzést írt. Ez a szolgáltató (${host}) oldalán dől el; a mentés változatlan.`);
  validateOutput(parsed,schema);
  return parsed;
 }
 const first=await once();
 try{return parse(first);}
 catch(error){
  if(/tartalmi szűrő|elutasít|hosszkorlátot|üres választ/.test(error.message))throw error;
  // Egy javító újrapróbálkozás alacsonyabb hőfokon, a konkrét hibával: a formátumhiba ne a játékos körébe kerüljön.
  const detail=String(error.message).replace(/^Az API válasza nem felel meg a játék adatsémájának/,'').replace(/\. A mentés változatlan\.$/,'').slice(0,200);
  const retry=await once(`Az előző válasz hibás volt${detail?`: ${detail}`:''}. Ugyanazt a jelenetet add vissza, de kizárólag a séma szerinti mezőkkel és típusokkal, a felsorolt karakterazonosítókkal, érvényes JSON-ként.`,Math.min(temperature,0.6));
  try{return parse(retry);}catch{throw error;}
 }
}
export async function checkApi(config,key,fetcher=fetch){
 const result=await request(config,key,'/models',null,fetcher);
 if(!Array.isArray(result.data))throw Error('Az API nem adott modelllistát.');
 const models=result.data.filter(m=>typeof m?.id==='string').map(m=>m.id);
 if(!models.includes(config.apiModel))throw Error('A megadott modell nincs az API modelllistájában.');
 return {ok:true,status:'API-kapcsolat rendben; modell elérhető.',models};
}
