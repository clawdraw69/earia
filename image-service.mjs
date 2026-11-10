import {promises as fs,constants,createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {randomUUID,randomInt} from 'node:crypto';
import {createInterface} from 'node:readline';
import {stopChild} from './motor-lifecycle.mjs';
import {selectedCharacters,referenceFiles,visualCharacter} from './character-images.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const FINISHED=new Set(['done','error','cancelled']);
export const IMAGE_MODELS=[{id:'sd15',name:'Stable Diffusion 1.5',architecture:'SD1.5',files:['sd15/model_index.json','source.json'],defaultSize:'512x512'}, {id:'pony-v6-xl',name:'Pony Diffusion V6 XL',architecture:'SDXL',files:['pony-v6-xl/ponyDiffusionV6XL_v6StartWithThisOne.safetensors','pony-v6-xl/config/model_index.json','pony-v6-xl/config-source.json','pony-v6-xl/source.json'],defaultSize:'768x768'}, {id:'yiffymix',name:'YiffyMix',architecture:'SD1.5',files:['yiffymix/yiffymix.safetensors','sd15/model_index.json','sd15/tokenizer/vocab.json','sd15/text_encoder/model.fp16.safetensors'],defaultSize:'512x768'}];
export function imageOptions(input={}){
 const model=String(input.model??'sd15');if(!IMAGE_MODELS.some(m=>m.id===model))throw Error('Nem támogatott képmodell.');
 const prompt=String(input.prompt??'').trim();
 if(!prompt||prompt.length>1500)throw Error('Adj meg 1–1500 karakteres képleírást.');
 const negative=String(input.negative??'blurry, low quality, text, watermark').trim();
 if(negative.length>500)throw Error('Túl hosszú kizáró leírás.');
 const width=Number(input.width??512),height=Number(input.height??512),steps=Number(input.steps??25),guidance=Number(input.guidance??7);
 const arch=(IMAGE_MODELS.find(m=>m.id===model)||{}).architecture||'SD1.5';const sizes=arch==='SD1.5'?[512,640,768]:[512,768,1024];
 if(!sizes.includes(width)||!sizes.includes(height)||width*height>(arch==='SD1.5'?393216:1048576))throw Error('A választott képmodellhez nem támogatott képméret.');
 if(!Number.isInteger(steps)||steps<10||steps>40||!Number.isFinite(guidance)||guidance<1||guidance>12)throw Error('Érvénytelen képbeállítás.');
 const seed=input.seed===undefined||input.seed===''?randomInt(2147483647):Number(input.seed);
 if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw Error('A seed 0–2147483647 közötti egész szám lehet.');
 return {model,prompt,negative,width,height,steps,guidance,seed};
}
export class ImageService{
 constructor({root,saves,locks=new Set(),spawner=spawn}){Object.assign(this,{root,saves,locks,spawner});this.jobs=new Map();this.active=null;this.saving=new Set();}
 busyFor(id){return this.active?.gameId===id||this.saving.has(id);}
 async directory(id){
  if(!UUID.test(id))throw Error('Érvénytelen mentésazonosító.');
  const base=await fs.realpath(this.saves),dir=path.join(base,id);
  if((await fs.lstat(dir)).isSymbolicLink()||await fs.realpath(dir)!==dir)throw Error('Nem biztonságos mentésútvonal.');
  await fs.access(path.join(dir,'game.json'));
  const images=path.join(dir,'images');await fs.mkdir(images,{recursive:true});
  if((await fs.lstat(images)).isSymbolicLink()||await fs.realpath(images)!==images)throw Error('Nem biztonságos képmappa.');
  return images;
 }
 async python(){
  const portable=path.join(this.root,'image-gen','runtime','python.exe');
  try{await fs.access(portable);return portable;}catch{return path.join(this.root,'image-gen','.venv','Scripts','python.exe');}
 }
 async availableModels(){
  const found=[];for(const model of IMAGE_MODELS){try{await fs.access(await this.python());for(const file of model.files)await fs.access(path.join(this.root,'image-gen','models',file));found.push({id:model.id,name:model.name,architecture:model.architecture,defaultSize:model.defaultSize});}catch{}}
  return found;
 }
 publicJob(job){if(!job)return null;const {child,requestFile,output,...safe}=job;return {...safe,previewUrl:job.phase==='done'?`/api/images/${job.gameId}/preview?job=${job.id}`:null};}
 async styleRoots(){
  const base=path.join(this.root,'image-gen','references','styles');
  try{
   const dirs=await fs.readdir(base,{withFileTypes:true});const out=[];
   for(const d of dirs){
    if(!d.isDirectory())continue;
    const files=(await fs.readdir(path.join(base,d.name))).filter(f=>/\.(png|jpe?g|webp)$/i.test(f)).sort();
    if(files.length)out.push({name:d.name,file:files[0],count:files.length});
   }
   return out.sort((a,b)=>a.name.localeCompare(b.name,'hu'));
  }catch{return [];}
 }
 async list(id){const dir=await this.directory(id),items=[];for(const name of (await fs.readdir(dir)).filter(n=>/^\d{3,}\.json$/.test(n)).sort()){
  try{const item=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));const stem=name.slice(0,-5);await fs.access(path.join(dir,stem+'.png'));items.push({...item,file:stem+'.png',url:`/api/images/${id}/file?name=${stem}.png`});}catch{}
 }return items;}
 async status(id){const models=await this.availableModels();return {installed:models.length>0,models,styles:await this.styleRoots(),job:this.publicJob(this.jobs.get(id)),images:await this.list(id),busy:Boolean(this.active)};}
 async generate(id,input){
  if(this.active)throw Error('Már készül egy kép. Várd meg, vagy szakítsd meg.');
  if(this.locks.has(id)||this.saving.has(id))throw Error('A mentés éppen frissül.');
  const options=imageOptions(input);
  const job={id:randomUUID(),gameId:id,phase:'starting',percent:null,message:'Képgenerálás indítása…',createdAt:new Date().toISOString(),options};
  this.active=job;
  try{
   const dir=await this.directory(id);if(!(await this.availableModels()).some(m=>m.id===options.model))throw Error('A választott képmodell nincs teljesen telepítve. Futtasd a KEP_MOTOR_TELEPITES.cmd fájlt; YiffyMix esetén másold be a checkpointot is.');
   let references=[];
   if(input.characterId||(input.characterIds?.length)){
    const saveDir=path.dirname(dir),g=JSON.parse(await fs.readFile(path.join(saveDir,'game.json'),'utf8'));
    const chars=selectedCharacters(g,input);
    options.characterIds=chars.map(c=>c.id);options.characters=chars.map(visualCharacter);
    if(input.characterId){options.characterId=input.characterId;options.kind='character';}
    else{
     references=await referenceFiles(saveDir,g,chars);options.kind='scene';
     const adapterRoot=path.join(this.root,'image-gen','models','ip-adapter');
     const adapterFile=options.model==='pony-v6-xl'?'sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors':'models/ip-adapter-plus_sd15.safetensors';
     for(const f of ['models/image_encoder/config.json','models/image_encoder/model.safetensors',adapterFile])try{await fs.access(path.join(adapterRoot,f));}catch{throw Error('A képreferencia-modul még nincs teljesen telepítve.');}
     options.referenceStrength=Number(input.referenceStrength??0.65);
     if(!Number.isFinite(options.referenceStrength)||options.referenceStrength<0.1||options.referenceStrength>1)throw Error('A referencia erőssége 0,1–1 lehet.');
     options.references=chars.map(c=>({characterId:c.id,file:c.visual.referenceFile}));
    }
   }
   const previous=this.jobs.get(id);if(previous){for(const f of [previous.output,previous.requestFile])if(f)await fs.unlink(f).catch(()=>{});}
   job.output=path.join(dir,`.draft-${job.id}.png`);job.requestFile=path.join(dir,`.request-${job.id}.json`);
   await fs.writeFile(job.requestFile,JSON.stringify({...options,references,output:job.output}));this.jobs.set(id,job);
   if(job.phase==='cancelled'){await fs.unlink(job.requestFile).catch(()=>{});if(this.active===job)this.active=null;return this.publicJob(job);}
   const log=createWriteStream(path.join(this.root,'logs','image-engine.log'),{flags:'a'});
   const child=this.spawner(await this.python(),['-u',path.join(this.root,'image-gen','worker.py'),job.requestFile],{cwd:this.root,windowsHide:true,stdio:['ignore','pipe','pipe']});job.child=child;
   child.stderr.pipe(log,{end:false});
   createInterface({input:child.stdout}).on('line',line=>{try{const e=JSON.parse(line);if(job.phase==='cancelled')return;if(['loading','generating','finishing','done','error'].includes(e.phase)){Object.assign(job,{phase:e.phase==='done'?'finishing':e.phase,percent:e.percent??null,message:e.message});job.workerDone=e.phase==='done';}}catch{}});
   child.on('error',e=>{job.phase='error';job.message='A képmotor nem indul: '+e.message;});
   child.on('close',async code=>{
    if(job.phase!=='cancelled'&&job.phase!=='error'){
     if(code===0&&job.workerDone){job.phase='done';job.message='A kép elkészült. A pipával mentheted.';}
     else{job.phase='error';job.message='A képmotor leállt. Részletek: logs/image-engine.log.';}
    }
    if(this.active===job)this.active=null;delete job.child;log.end();await fs.unlink(job.requestFile).catch(()=>{});
   });
   return this.publicJob(job);
  }catch(e){if(this.active===job)this.active=null;job.phase='error';job.message=e.message;this.jobs.set(id,job);throw e;}
 }
 async cancel(id){const job=this.active;if(!job||job.gameId!==id)return;job.phase='cancelled';job.message='Képgenerálás megszakítva.';const child=job.child;if(child){
  // Windows venv python launches another process: terminate the owned tree.
  if(process.platform==='win32'&&child.pid)await new Promise((resolve,reject)=>execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},error=>{if(error&&child.exitCode===null)reject(Error('A képmotor nem állt le. Próbáld újra.'));else resolve();}));
  else await stopChild(child);
  if(this.active===job)this.active=null;
 }}
 async stop(){if(this.active)await this.cancel(this.active.gameId);}
 async accept(id,jobId){
  const job=this.jobs.get(id);if(!job||job.id!==jobId||job.phase!=='done')throw Error('Nincs menthető előnézet.');
  if(this.saving.has(id)||this.locks.has(id))throw Error('Mentés folyamatban.');if(job.saved)return job.saved;
  this.saving.add(id);
  try{
   const dir=await this.directory(id),names=await fs.readdir(dir);let n=Math.max(0,...names.filter(n=>/^\d{3,}\.(png|json)$/.test(n)).map(n=>Number(n.split('.')[0])))+1;
   const stem=String(n).padStart(3,'0'),dest=path.join(dir,stem+'.png');
   const data={number:n,file:stem+'.png',createdAt:new Date().toISOString(),...job.options};
   await fs.copyFile(job.output,dest,constants.COPYFILE_EXCL);
   try{await fs.writeFile(path.join(dir,stem+'.json'),JSON.stringify(data,null,2),{flag:'wx'});}catch(e){await fs.unlink(dest);throw e;}
   job.saved={...data,url:`/api/images/${id}/file?name=${stem}.png`};return job.saved;
  }finally{this.saving.delete(id);}
 }
 async image(id,{name,jobId}){
  const dir=await this.directory(id);let file;
  if(name){if(!/^\d{3,}\.png$/.test(name))throw Error('Érvénytelen képfájlnév.');file=path.join(dir,name);}
  else{const job=this.jobs.get(id);if(!job||job.id!==jobId||job.phase!=='done')throw Error('Az előnézet nem érhető el.');file=job.output;}
  if((await fs.lstat(file)).isSymbolicLink())throw Error('Nem biztonságos képfájl.');return fs.readFile(file);
 }
}
