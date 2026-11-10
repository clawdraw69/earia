import {ImageService} from './image-service.mjs';
import {imageContext,IMAGE_PROMPT_SYSTEM,attachCharacterImage} from './character-images.mjs';
import {LocalMotor,LOCAL_MODEL} from './local-motor.mjs';
import {deleteSave} from './delete-save.mjs';
import {API_DEFAULTS,publicConfig,remoteInfer,checkApi} from './api-provider.mjs';
import {revealKey} from './api-secret.mjs';
import {nextSettings} from './settings.mjs';
import {persistGame,atomicJson} from './storage.mjs';
import {validMessages,appendNonempty} from './ai-state.mjs';
import {isUppercaseOoc} from './public/chat-input.js';
import http from 'node:http';
import {directOocPlan,isOocCorrection,applyOocPlan,oocSchema,OOC_SYSTEM} from './ooc.mjs';
import {responseSchema} from './response-schema.mjs';
import {narratorCharacters,narratorTurn,characterAppearance} from './narrator.mjs';import {loadRules,buildSystem} from './prompt.mjs';
import {samplingForModel} from './model-profile.mjs';

import path from 'node:path';
import {listModels,browseModel} from './models.mjs';
import {fileURLToPath} from 'node:url';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {validateCharacter,calendar,advanceTime,startScene,stepScene,desiredState,seedDesire,applyDesireEvents} from './rules.mjs';const AI_KEY=randomUUID();const ROOT=path.dirname(fileURLToPath(import.meta.url)),SAVES=process.env.EARIA_SAVES||path.join(ROOT,'saves'),PORT=Number(process.env.EARIA_PORT||43141),AI_PORT=Number(process.env.EARIA_AI_PORT||43142);
await fs.mkdir(SAVES,{recursive:true});await fs.mkdir(path.join(ROOT,'logs'),{recursive:true});
const world=JSON.parse(await fs.readFile(path.join(ROOT,'data/world.json'),'utf8'));
const CONFIG_FILE=process.env.EARIA_CONFIG||path.join(ROOT,'config.json');
const defaults={...API_DEFAULTS,provider:'api',modelPath:'',runtimePath:path.join(ROOT,'runtime','llama-server.exe'),contextSize:8192,gpuLayers:99};
let config={...defaults};try{config={...defaults,...JSON.parse((await fs.readFile(CONFIG_FILE,'utf8')).replace(/^\uFEFF/,''))};}catch{}
for(const key of ['modelPath','runtimePath'])if(config[key]&&!path.isAbsolute(config[key]))config[key]=path.resolve(ROOT,config[key]);config.narrationTemperature=Math.min(1,Math.max(0.6,Number(config.narrationTemperature)||0.75));
const motor=new LocalMotor({root:ROOT,port:AI_PORT,key:AI_KEY});
let shuttingDown=false;let generation=false;const locks=new Set();
const pictures=new ImageService({root:ROOT,saves:SAVES,locks});
function gameDir(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Érvénytelen mentésazonosító.');return path.join(SAVES,id);}
function migrateGame(g){
 if((g.schema??0)>=3)return g;
 if((g.schema??0)<2){for(const c of g.characters){const o=Number(c.orientation);if(Number.isFinite(o))c.orientation=Math.min(7,Math.max(1,7-Math.round(o*6/10)));}}
 for(const c of g.characters){const heat=Math.max(Number(c.state?.vf)||1,Number(c.state?.vn)||1);c.state={...(c.state||{}),...desiredState(c,heat)};}
 g.schema=3;return g;
}
async function readGame(id){return migrateGame(JSON.parse(await fs.readFile(path.join(gameDir(id),'game.json'),'utf8')));}
const atomic=atomicJson;
async function writeGame(g){const warnings=await persistGame(gameDir(g.id),g);return warnings;}
function publicGame(g){const {privateStory,adminState,...safe}=g;return {...safe,calendar:calendar(g.minutes),characters:g.characters.map(c=>({...c,avatarUrl:`/avatar/${g.id}/${c.id}?v=${g.updatedAt}`}))};}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let n=0,chunks=[];for await(const chunk of req){n+=chunk.length;if(n>4_000_000)throw Error('Túl nagy kérés.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Error('Hibás kérésformátum.');}}
const MODEL_DIRECTORY=path.join(ROOT,'models');let modelPickerOpen=false;
async function discover(){return (await listModels(MODEL_DIRECTORY)).map(m=>m.path);}
let startingAI=null;
async function startAI(){if(config.provider==='api')return {status:'API-mód: nincs helyi motor. A Kapcsolat ellenőrzése gombbal ellenőrizheted az API-t.'};if(startingAI)return startingAI;startingAI=startAIImpl();try{return await startingAI;}finally{startingAI=null;}}
async function startAIImpl(){if(pictures.active)throw Error('Előbb fejezd be a képgenerálást.');if(!config.modelPath)config.modelPath=(await discover())[0]||'';if(!config.modelPath)throw Error('Nem találok helyi modellt. Válassz GGUF fájlt a Beállításoknál.');return motor.start(config);}
async function health(){if(config.provider==='api')return {ready:Boolean(config.apiKeyEncrypted),status:config.apiKeyEncrypted?'API beállítva · '+config.apiModel+' (kapcsolat nincs ellenőrizve)':'API-kulcs szükséges'};return motor.status();}
async function infer(system,user,gameContext,isSetup=false,customSchema=null){if(config.provider==='api'){if(generation)throw Error('A mesélő még dolgozik.');generation=true;try{return await remoteInfer(config,await revealKey(config.apiKeyEncrypted),system,user,customSchema||responseSchema(gameContext,isSetup),{temperature:customSchema ? 0.1 : (isSetup ? Math.min(config.narrationTemperature??0.8,0.7) : (config.narrationTemperature??0.8))});}finally{generation=false;}}await startAI();await motor.waitReady();if(generation)throw Error('A mesélő még dolgozik az előző válaszon.');generation=true;try{const r=await fetch(`http://127.0.0.1:${AI_PORT}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+AI_KEY},body:JSON.stringify({model:LOCAL_MODEL,messages:[{role:'system',content:system},{role:'user',content:user}],...samplingForModel(config.modelPath),...(customSchema?{temperature:0.1}:{}),max_tokens:2200,response_format:{type:'json_object',schema:customSchema||responseSchema(gameContext,isSetup)},chat_template_kwargs:{enable_thinking:false}}),signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('Modellhiba: '+(await r.text()).slice(0,500));const result=await r.json();if(result.choices?.[0]?.finish_reason==='length')throw Error('A modell válasza elérte a hosszkorlátot; a mentés változatlan.');let text=result.choices?.[0]?.message?.content??'';text=text.replace(/<think>[\s\S]*?<\/think>/g,'').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');let parsed;try{parsed=JSON.parse(text);}catch{throw Error('A mesélő nem adott feldolgozható választ. A mentés változatlan; próbáld újra.');}return parsed;}finally{generation=false;}}
const RULES_FILE=path.join(ROOT,'prompts','narrator.md');
function systemRules(){return loadRules(RULES_FILE);}
const system=()=>buildSystem(world,systemRules().text,{adultTone:config.adultTone!==false});
function applyAI(g,data){const messages=validMessages(data,g);const elapsed=Number(data.elapsedMinutes??0);if(!Number.isFinite(elapsed)||elapsed<0||elapsed>10080)throw Error('Hibás időbecslés.');advanceTime(g,elapsed);g.messages.push(...messages);g.summary=typeof data.summary==='string'?data.summary.slice(0,4000):g.summary;g.location=typeof data.location==='string'?data.location.slice(0,120):g.location;g.choices=Array.isArray(data.choices)?data.choices.filter(c=>typeof c==='string').slice(0,4).map(c=>c.slice(0,300)):[];appendNonempty(g.memories,data.memory,2000);g.privateStory??={};g.privateStory.updates??=[];appendNonempty(g.privateStory.updates,data.privateUpdate,4000);g.privateStory.updates=g.privateStory.updates.slice(-12);
 // Fallback: ha a modell nem ad events-et, a szövegből következtetünk.
 let events = Array.isArray(data.events) ? data.events.filter(e=>e&&typeof e==='object'&&e.contacts&&typeof e.contacts==='object').slice(0,12) : [];
 g.pendingEvents = events;
 g.lastDesire=applyDesireEvents(g, data.desireEvents);
 g.candidate=data.candidate&&typeof data.candidate.name==='string'?{name:data.candidate.name.slice(0,60),description:String(data.candidate.description??'').slice(0,2000)}:null;return g;}
async function imagePromptFor(g){
 const chars=narratorCharacters(g).map(c=>({name:c.name,sex:c.sex,age:c.age,clan:c.clan,appearance:c.appearance,attributes:c.attributes,state:c.state,orientation:c.orientation}));
 const scene=g.scene&&g.scene.active?{round:g.scene.round,members:(g.scene.members||[]).map(m=>({name:(g.characters.find(c=>c.id===m.id)||{}).name,contacts:m.contacts,directions:m.directions,completed:m.completed}))}:null;
 const recent=(g.messages||[]).filter(m=>m.speaker!=='ooc').slice(-6).map(m=>({speaker:m.speaker==='narrator'?'narrator':((g.characters.find(c=>c.id===m.speaker)||{}).name||'játékos'),text:m.text}));
 const system='You write image-generation prompts for the Perchance "furry-ai" generator. Output ONLY comma-separated lowercase English tags (danbooru/e621 style), no sentences, no quotes, no explanations. Be extremely detailed. When the scene is sexual, be explicit and use direct anatomical words (penis, cock, knot, vagina, pussy, anus, semen, cum) and explicit act tags. Structure the positive prompt in this order: quality tags, medium/style, species and anthro type, sex/gender, body type and attributes, fur/eye colors, genital description and state, pose and position, partner and interaction, orifices/acts, fluids, setting and location, lighting/time of day, camera angle and framing, mood. Negative prompt: ONLY quality/anatomy defects, text/watermark, and any non-adult content (child, loli, underage, cub). NEVER put a character, sex, genital or body part that is present in the scene into the negative prompt.';
 const user=JSON.stringify({location:g.location,summary:g.summary,scene,recent,characters:chars});
 const data=await infer(system,user,g,false,{type:'object',properties:{positive:{type:'string',maxLength:2200},negative:{type:'string',maxLength:1000}},required:['positive','negative'],additionalProperties:false});
 return {positive:data.positive||'',negative:data.negative||''};
}
const output=`Válaszmezők: messages: [{speaker:"narrator" vagy karakterazonosító,text:"magyar narráció vagy párbeszéd"}], summary: rövid aktuális összefoglaló, location: helyszín, elapsedMinutes: az eltelt percek becslése, choices: 2–4 cselekvési lehetőség. Ha testi együttlét kezdődik vagy folytatódik, minden résztvevőre adj events elemet: characterId, contacts (objektum: kulcs a zóna, érték 1, ha van érintkezés), directions (male/female), reason. Példa: ha Baal nyalja Kaitet: Kait: {"vaginal": 1}, Baal: {"oral": 1}. Ha Baal ujjazza Kait fenekét: Kait: {"anal": 1}. Ha többen érintik ugyanazt a zónát, az érték akkor is 1. Ha nincs érintkezés: üres objektum. A köröket NEM te indítod: az events csak javaslat, a játékos indítja gombbal. Ezen kívül add meg a desireEvents listát, ha a körben bármi növelte valakinek a vágyát (jeleneten kívül, aktus közben nem): [{characterId, kind, partnerId, reason}], ahol a kind: sleep_together, day_together, intense_touch, erogenous_give, erogenous_receive, nudity, scent. A vágy-növekedést a program számolja (max +0,5/kör), te csak a történést címkézed. Egyébként, memory: egy új fontos tény vagy üres szöveg, privateUpdate: titkos terv frissítése vagy üres szöveg. events: opcionális javasolt körterhelések. candidate: null vagy {name,description}, ha egy alkalmi felnőtt NPC fontossá vált.`;
async function mutate(id,fn){if(locks.has(id))throw Error('Ez a mentés éppen frissül.');locks.add(id);try{const g=await readGame(id);await fn(g);const storageWarnings=await writeGame(g);return {...publicGame(g),storageWarnings};}finally{locks.delete(id);}}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://127.0.0.1:${PORT}`),p=url.pathname;if(![`127.0.0.1:${PORT}`,`localhost:${PORT}`].includes(req.headers.host))return send(res,403,{error:'Tiltott host.'});if(req.method==='POST'&&req.headers.origin&&!['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(req.headers.origin))return send(res,403,{error:'Tiltott eredet.'});
if(shuttingDown)return send(res,503,{error:'A játék leáll.'});
if(p==='/api/quit'&&req.method==='POST'){if(generation||locks.size)throw Error('Várd meg az aktuális művelet befejezését, majd lépj ki.');shuttingDown=true;try{await stopMotor();}catch(error){shuttingDown=false;throw error;}send(res,200,{ok:true});setTimeout(stop,100);return;}if(p==='/api/status'){const rules=systemRules();return send(res,200,{...await health(),busy:generation,config:publicConfig(config),models:await discover(),prompt:{hash:rules.hash,file:'prompts/narrator.md',missing:Boolean(rules.missing)},version:'0.5.0',build:'portable-05-20261110'});}
 if(p==='/api/prompt'&&req.method==='GET'){const rules=systemRules();return send(res,200,{hash:rules.hash,file:'prompts/narrator.md',text:rules.text});}
const imageRoute=p.match(/^\/api\/images\/([a-f0-9-]+)(?:\/(generate|cancel|accept|preview|file|prompt|reference))?$/);
if(imageRoute){
 const [,id,action]=imageRoute;
 if(req.method==='GET'&&!action)return send(res,200,await pictures.status(id));
 if(req.method==='GET'&&['preview','file'].includes(action)){
  const bytes=await pictures.image(id,{name:action==='file'?url.searchParams.get('name'):null,jobId:url.searchParams.get('job')});
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(bytes);
 }
 if(req.method!=='POST')throw Error('Nem támogatott képművelet.');
 const input=await body(req);
 if(action==='generate'){if(motor.active)throw Error('A képgenerálás előtt állítsd le a helyi szövegmodellt, hogy felszabaduljon a videomemória.');return send(res,200,await pictures.generate(id,input));}
 if(action==='cancel'){await pictures.cancel(id);return send(res,200,{ok:true});}
 if(action==='accept')return send(res,200,await pictures.accept(id,input.jobId));
 if(action==='reference'){
  const job=pictures.jobs.get(id);
  if(!job||job.id!==input.jobId||job.phase!=='done'||!job.options.characterId)throw Error('Nincs elfogadható karakterkép.');
  const saved=await pictures.accept(id,input.jobId);
  const png=await pictures.image(id,{name:saved.file});
  const updated=await mutate(id,async g=>{
   const c=g.characters.find(c=>c.id===job.options.characterId);if(!c)throw Error('A karakter már nem található.');
   await attachCharacterImage(gameDir(id),g,c,{png,jpeg:input.jpeg,saved,snapshot:job.options.characters[0]});
  });job.referenceAccepted=true;return send(res,200,updated);
 }
 const STYLE_PRESETS={
 semi:{pos:'semi-realistic, detailed fur rendering, soft cinematic lighting, high detail, vivid colors',neg:'cartoon, toon, cel shading, flat color, chibi, comic book'},
 photo:{pos:'photorealistic, hyperdetailed fur, realistic anatomy, cinematic lighting, 85mm photograph, depth of field, film grain',neg:'cartoon, anime, comic, illustration, painting, cel shading, flat color'},
 comic:{pos:'comic style, bold ink outlines, cel shading, vivid colors',neg:''},
 anime:{pos:'anime style, cel shading, vibrant colors',neg:''},
 erotic:{erotic:true,pos:'erotic art, sensual moody lighting, low key light, dramatic shadows, rim light, half-lidded eyes, seductive expression, parted lips, mature face, glossy fur, sweat sheen, detailed anatomy, seductive reclining pose, cinematic composition, dark bedroom background, candlelight',neg:'cartoon, chibi, cute, goofy, funny, smile, grinning, bright flat lighting, plain background, pastel colors, simple shading'},
 erotic_male:{erotic:true,pos:'erotic art, masculine male body, low key light, dramatic shadows, rim light, half-lidded eyes, confident smirk, mature masculine face, glossy fur, sweat sheen, erect penis with swollen knot, reclining on bed, dark bedroom background, candlelight',neg:'cartoon, chibi, cute, goofy, funny, smile, grinning, bright flat lighting, plain background, pastel colors, simple shading, feminine'}
};
if(action==='prompt'){
  if(config.provider!=='api')throw Error('A jelenetprompt készítéséhez válaszd az API-s mesélőt. Kézzel is megadhatsz angol képleírást.');
  const g=await readGame(id);
  const schema={type:'object',properties:{prompt:{type:'string',maxLength:600}},required:['prompt'],additionalProperties:false};
const ctx=imageContext(g,input);
  const result=await infer(IMAGE_PROMPT_SYSTEM,JSON.stringify(ctx),g,false,schema);
  const styleTags=[];
  const styleName=String(input.style||'').replace(/[^\p{L}\p{N} _-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,120);
  if(styleName)styleTags.push(styleName+' style');
  const styleText=String(input.styleText||'').replace(/[<>{}\[\]]/g,' ').replace(/\s+/g,' ').trim().slice(0,200);
  if(styleText)styleTags.push(styleText);
  const preset=STYLE_PRESETS[String(input.stylePreset||'')]||null;
  const cleanedPrompt=preset?.erotic?result.prompt.replace(/neutral background,?/gi,'').replace(/plain background,?/gi,'').replace(/standing,?/gi,'reclining,').replace(/simple clothing,?/gi,'').replace(/suggestive pose,?/gi,''):result.prompt;
  const twoCharacters=Array.isArray(input.characterIds)&&input.characterIds.length===2;
  let presetPos=preset?preset.pos:'';
  if(twoCharacters&&preset?.erotic)presetPos=presetPos.replace(/seductive reclining pose,?/gi,'').replace(/reclining on bed,?/gi,'both lying side by side,');
  const presetTags=presetPos;
  const prefix=[];
  if(preset&&input.model==='pony-v6-xl')prefix.push('score_9, score_8_up, score_7_up, source_furry');
  if(presetTags)prefix.push(`(${presetTags}:1.2)`);
  if(twoCharacters)prefix.push('(two separate characters, two bodies, side by side, clear gap between them:1.35)');
  const withStyle=prompt=>{
   const extra=styleTags.length?styleTags.join(', '):'';
   return (prefix.length?prefix.join(', ')+', ':'')+prompt+(extra?', '+extra:'');
  };
  const c=(ctx.characters||[])[0];
  if(ctx.mode==='character'&&c){
   const full=Number(c.bodyShape?.fullness)||4;
   const base='blurry, low quality, text, watermark, fused hands, extra arms, merged limbs, glowing, neon, silhouette, backlit, flat color, monochrome, multiple characters, multiple views, duplicate, twins, cropped head';
   const negative=(full>=6?base+', slim, lean, muscular, abs, thin waist':(full<=2?base+', fat, overweight, huge belly':base))+(preset&&preset.neg?', '+preset.neg:'');
   const sexTag=c.sex==='male'?'male, masculine face, masculine body, broad shoulders, strong jaw':'female, feminine';
 const anatomy=preset?.erotic&&c.sex==='male'?'erect penis visible with knot, ':' ';
   return send(res,200,{prompt:withStyle(`(${c.build}:1.3), (${sexTag}:1.3), ${anatomy}${cleanedPrompt}`),negative});
  }
  return send(res,200,{...result,prompt:withStyle(cleanedPrompt)});
 }
 throw Error('Ismeretlen képművelet.');
}
if(p==='/api/models'&&req.method==='GET')return send(res,200,{directory:MODEL_DIRECTORY,models:await listModels(MODEL_DIRECTORY)});
if(p==='/api/models/browse'&&req.method==='POST'){if(modelPickerOpen)throw Error('A fájlválasztó már nyitva van.');modelPickerOpen=true;try{const model=await browseModel(MODEL_DIRECTORY,path.join(ROOT,'select-model.ps1'));return send(res,200,{model,cancelled:!model});}finally{modelPickerOpen=false;}}
if(p==='/api/settings'&&req.method==='POST'){const b=await body(req);if(motor.active||startingAI||generation||locks.size)throw Error('Előbb fejezd be az aktuális műveletet és állítsd le a helyi modellt.');const next=await nextSettings(config,b);await atomic(CONFIG_FILE,next);config=next;return send(res,200,{ok:true,config:publicConfig(config)});}
if(p==='/api/ai/check'&&req.method==='POST'){if(config.provider!=='api')throw Error('Előbb válaszd az API-módot.');if(generation)throw Error('A mesélő még dolgozik.');generation=true;try{return send(res,200,await checkApi(config,await revealKey(config.apiKeyEncrypted)));}finally{generation=false;}}
if(p==='/api/ai/start'&&req.method==='POST')return send(res,200,await startAI());
if(p==='/api/ai/stop'&&req.method==='POST'){if(generation||locks.size)throw Error('Várd meg az aktuális műveletet.');await stopMotor();return send(res,200,{ok:true});}
if(p==='/api/games'&&req.method==='GET'){const items=[];for(const id of await fs.readdir(SAVES)){try{const g=await readGame(id);const player=g.characters.find(c=>c.id===g.playerId);g.scene={active:false,round:0,members:[]};await writeGame(g);items.push({id:g.id,title:g.title,player:player.name,updatedAt:g.updatedAt,location:g.location,started:g.started,avatarUrl:`/avatar/${g.id}/${player.id}`});}catch{}}return send(res,200,items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));}
if(p==='/api/games'&&req.method==='POST'){const b=await body(req),validated=validateCharacter(b.player),player={...validated,id:randomUUID(),state:seedDesire(validated,b.player?.desire)};const g={schema:3,id:randomUUID(),title:String(b.title||player.name+' története').slice(0,100),playerId:player.id,characters:[player],minutes:0,location:'',summary:'',messages:[],memories:[],privateStory:{},setup:{},started:false,scene:{active:false,round:0,members:[]},pendingEvents:[],candidate:null};await writeGame(g);return send(res,200,publicGame(g));}
if(p==='/api/ooc-chat'&&req.method==='POST'){const b=await body(req);if(!b.text||typeof b.text!=='string'||!b.gameId)throw Error('Üres üzenet vagy hiányzó játékazonosító.');const game=await readGame(b.gameId);const oocSystem=`Te egy okos, segítőkész asszisztens vagy, aki az Earia világ szerepjáték-motorjának fejlesztésében segít. A játékos OOC-ban (out of character) kérdez tőled. Válaszolj magyarul, természetes, folyékony stílusban, részletesen. Ha a játékos a szabályokról, a kódról, a karakterekről vagy a motor működéséről kérdez, adj pontos, technikai választ. Ha inkonzisztenciát észlelsz a történetben, javasolj korrekciót. Ne írj le jelenetet, ne használd a "Mit teszel most?" struktúrát.`;const data=await infer(oocSystem, `A játékos OOC üzenete: ${b.text}\n\nJelenlegi állapot (kontextus): ${JSON.stringify({characters:narratorCharacters(game), summary:game.summary, scene:game.scene})}`, game, false, { type: 'object', properties: { answer: { type: 'string', maxLength: 8000 } }, required: ['answer'], additionalProperties: false });return send(res,200,{answer:data.answer});}
const match=p.match(/^\/api\/games\/([a-f0-9-]+)(?:\/([\w-]+))?$/);if(match){const [,id,action]=match;if(!action&&req.method==='GET')return send(res,200,publicGame(await readGame(id)));if(req.method!=='POST')throw Error('Nem támogatott művelet.');const b=await body(req);if(action==='delete'){if(pictures.busyFor(id))throw Error('Előbb fejezd be a képműveletet.');await deleteSave(SAVES,id,b,locks);return send(res,200,{ok:true,deletedId:id});}if(action==='image-prompt'){const g=await readGame(id);const prompt=await imagePromptFor(g);return send(res,200,prompt);}const result=await mutate(id,async g=>{if(action==='character'){const validated=validateCharacter(b.character),c={...validated,id:randomUUID(),state:seedDesire(validated,b.character?.desire)};g.characters.push(c);g.candidate=null;}
else if(action==='avatar'){const c=g.characters.find(c=>c.id===b.characterId);if(!c)throw Error('Ismeretlen karakter.');const buffer=Buffer.from(String(b.jpeg??''),'base64');if(buffer.length>2_000_000||buffer[0]!==255||buffer[1]!==216)throw Error('Legfeljebb 2 MB-os JPEG avatár használható.');const folder=path.join(gameDir(id),c.id===g.playerId?'player':path.join('npcs',c.id));await fs.writeFile(path.join(folder,'avatar.jpg'),buffer);}
else if(action==='setup'){if(g.started)throw Error('A történet már elindult.');g.setup={location:String(b.location??'').slice(0,300),relationships:String(b.relationships??'').slice(0,4000),idea:String(b.idea??'').slice(0,4000)};const data=await infer(system(),`Új játék indul. Karakterek: ${JSON.stringify(narratorCharacters(g))}. A játékos elképzelése: ${JSON.stringify(g.setup)}. Előbb alkoss magadnak titkos történetvázlatot, és add vissza privatePlan objektumban: célok, titkok, lehetséges események. Kezdőnap 1. év 1. hónap 1. nap, kettős telihold, feral nincs. A nyitány még ne léptesse az időt. Adj initialStates listát: [{id,vf,vn}] minden karakterhez, a kezdőtörténetnek megfelelő 1–7 közötti értékekkel. ${output}`,g,true);if(!data.privatePlan||typeof data.privatePlan!=='object'||!Array.isArray(data.initialStates)||g.characters.some(c=>!data.initialStates.some(s=>s.id===c.id&&Number.isFinite(s.vf)&&s.vf>=1&&s.vf<=7&&Number.isFinite(s.vn)&&s.vn>=1&&s.vn<=10)))throw Error('Hiányos kezdőtörténet vagy kezdőállapot. Próbáld újra.');g.privateStory={plan:data.privatePlan,updates:[]};for(const c of g.characters){if(c.id===g.playerId)continue;const s=data.initialStates.find(s=>s.id===c.id);c.state=desiredState(c,Math.max(s.vf,s.vn));}data.elapsedMinutes=0;applyAI(g,data);g.started=true;}
else if(action==='chat'){if(!g.started)throw Error('Először állítsd össze a kezdést.');let text=String(b.text??'').trim();if(isUppercaseOoc(text))b.ooc=true;if(/^ooc\s*:/i.test(text)){b.ooc=true;text=text.replace(/^ooc\s*:\s*/i,'');}if(!text||text.length>6000)throw Error('Az üzenet 1–6000 karakter lehet.');if(text.toUpperCase()==='MOON'){const c=calendar(g.minutes);g.messages.push({id:randomUUID(),speaker:'narrator',text:`${c.year}.${c.month}.${c.day}. · ${c.hour}:${String(c.minute).padStart(2,'0')}\nArany: ${c.gold.toFixed(1)}, Kék: ${c.blue.toFixed(1)}. ${c.feral?'Feral nap.':c.doubleFull?'Kettős telihold: az Arany felülírja a Kéket.':'Nincs feral.'}`});}
else if(/^(\+CORE|CORE\+)\s/i.test(text)){const note=text.replace(/^(\+CORE|CORE\+)\s/i,'');g.coreFacts??=[];appendNonempty(g.coreFacts,note,6000);appendNonempty(g.memories,note,6000);g.messages.push({id:randomUUID(),speaker:'narrator',text:'Emlék rögzítve: '+note});}
else if(b.ooc&&!narratorTurn(g,text,true).appearanceOnly&&(directOocPlan(g,text)||isOocCorrection(text)||!text.includes('?'))){
 const before=structuredClone(g);
 const plan=directOocPlan(g,text)||await infer(OOC_SYSTEM,JSON.stringify({instruction:text,characters:narratorCharacters(g),setup:g.setup,summary:g.summary,memories:g.memories,privateStory:g.privateStory,canon:g.adminState?.canon||[],recentMessages:g.messages.slice(g.adminState?.historyFrom||0).slice(-12)}),g,false,oocSchema(g));
 const result=applyOocPlan(g,text,plan),backupDir=path.join(gameDir(g.id),'ooc-backups');
 await fs.mkdir(backupDir,{recursive:true});await atomic(path.join(backupDir,result.id+'.json'),{createdAt:new Date().toISOString(),instruction:text,plan,game:before});
 result.game.adminState.lastBackupId=result.id;
 result.game.messages.push({id:randomUUID(),speaker:'ooc',text},{id:randomUUID(),speaker:'system',source:'ooc-admin',text:'OOC javítás elmentve.\n'+result.changes.join('\n')+'\nA módosítási tervet alkalmaztam; a korábbi beszélgetés archívként látható, de nem kerül a mesélő kontextusába. Biztonsági másolat készült.'});
 Object.keys(g).forEach(k=>delete g[k]);Object.assign(g,result.game);return {rollback:before};
}
else{
 const turn=narratorTurn(g,text,b.ooc);
 if(turn.appearanceOnly){
  g.messages.push({id:randomUUID(),speaker:b.ooc?'ooc':g.playerId,text,contextKind:'appearance',appearanceRequest:turn.appearanceRequest});
  g.messages.push({id:randomUUID(),speaker:'narrator',source:'character-sheet',text:characterAppearance(g,turn.appearanceRequest,turn.detailed)});
 } else if (b.ooc) {
  // Okos OOC: külön asszisztens-prompt, nem a mesélői rendszer.
  const oocSystem = `Te egy okos, segítőkész asszisztens vagy, aki az Earia világ szerepjáték-motorjának fejlesztésében segít. A játékos OOC-ban (out of character) kérdez tőled. Válaszolj magyarul, természetes, folyékony stílusban, részletesen. Ha a játékos a szabályokról, a kódról, a karakterekről vagy a motor működéséről kérdez, adj pontos, technikai választ. Ha módosítani akar valamit, ismerd el, és mondd el, hogy a program a háttérben elvégzi (a ooc.mjs kezeli). Ne írj le jelenetet, ne használd a "Mit teszel most?" struktúrát.`;
  const data = await infer(oocSystem, `A játékos OOC üzenete: ${text}\n\nJelenlegi állapot (kontextus): ${JSON.stringify({characters: narratorCharacters(g), summary: g.summary, scene: g.scene})}`, g, false, { type: 'object', properties: { answer: { type: 'string', maxLength: 8000 } }, required: ['answer'], additionalProperties: false });
  g.messages.push({id:randomUUID(),speaker:'ooc',text});
  g.messages.push({id:randomUUID(),speaker:'narrator',source:'ooc-answer',text: data.answer || 'Nem érkezett válasz.'});
 } else {
  const before=g.messages.length;
  const data=await infer(system(),`${output}\n${turn.prompt}`,g);
  validMessages(data,g);
  g.messages.push({id:randomUUID(),speaker:g.playerId,text});
  applyAI(g,data);
  g.lastTurn={keep:before+1,desire:g.lastDesire||[]};
 }
}
}
else if(action==='scene'){if(b.command==='start')startScene(g);else if(b.command==='end')g.scene.active=false;else if(b.command==='step'){const logs=stepScene(g,b.contacts);g.messages.push({id:randomUUID(),speaker:'system',text:`${g.scene.round}. kör${g.scene.round<=2?' · bemelegítés, nincs levonás':''}. ${logs.join(' ')}`});g.pendingEvents=[];}else throw Error('Ismeretlen körművelet.');}
else if(action==='save-ooc-note'){const text=String(b.text??'').trim();if(!text||text.length>2000)throw Error('A megjegyzés 1–2000 karakter lehet.');g.memories.push('OOC: '+text);}else if(action==='undo-turn'){const keep=g.lastTurn?.keep;if(!keep||keep>g.messages.length)throw Error('Nincs visszavonható kör.');for(const d of (g.lastTurn.desire||[])){const c=g.characters.find(x=>x.id===d.id);if(c&&d.from)c.state={...c.state,...d.from};}g.messages=g.messages.slice(0,keep);g.lastTurn=null;g.pendingEvents=[];g.messages.push({id:randomUUID(),speaker:'system',text:'Az utolsó kör visszavonva.'});}
else if(action==='restore-ooc'){const dir=path.join(gameDir(id),'ooc-backups');const files=(await fs.readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.json')).sort();if(!files.length)throw Error('Nincs OOC-biztonsági mentés.');const backup=JSON.parse(await fs.readFile(path.join(dir,files[files.length-1]),'utf8'));if(!backup||!backup.game)throw Error('A biztonsági mentés sérült.');Object.keys(g).forEach(k=>delete g[k]);Object.assign(g,backup.game);g.messages.push({id:randomUUID(),speaker:'system',text:'Visszaállítva az utolsó OOC-javítás előtti állapot.'});}else if(action==='save'){}
else throw Error('Ismeretlen művelet.');});return send(res,200,result);}
const avatar=p.match(/^\/avatar\/([a-f0-9-]+)\/([a-f0-9-]+)$/);if(avatar){const g=await readGame(avatar[1]),c=g.characters.find(c=>c.id===avatar[2]);if(!c)throw Error('Nincs ilyen karakter.');const folder=c.id===g.playerId?'player':path.join('npcs',c.id);try{const bytes=await fs.readFile(path.join(gameDir(g.id),folder,'avatar.jpg'));res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-cache'});return res.end(bytes);}catch{res.writeHead(404);return res.end();}}
const files={'/':'index.html','/app.js':'app.js','/image-panel.js':'image-panel.js','/avatar-crop.js':'avatar-crop.js','/save-delete.js':'save-delete.js','/chat-input.js':'chat-input.js','/model-settings.js':'model-settings.js','/model-loading.js':'model-loading.js','/scene-view.js':'scene-view.js','/chat-marks.js':'chat-marks.js','/style.css':'style.css','/rules.mjs':'../rules.mjs'};if(files[p]){const ext=path.extname(files[p]);res.writeHead(200,{'Content-Type':ext==='.css'?'text/css; charset=utf-8':ext==='.html'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});return res.end(await fs.readFile(path.join(ROOT,'public',files[p])));}send(res,404,{error:'Nem található.'});
}catch(e){console.error(e.message);send(res,400,{error:e.message});}});
server.listen(PORT,'127.0.0.1',()=>console.log(`Earia 0.4: http://127.0.0.1:${PORT}`));
async function stop(){await stopMotor().catch(()=>{});server.close();setTimeout(()=>process.exit(0),500).unref();}process.on('SIGINT',stop);process.on('SIGTERM',stop);












async function stopMotor(){if(startingAI)await startingAI;try{await motor.stop();}finally{await pictures.stop();}}
