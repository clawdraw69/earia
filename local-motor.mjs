import {t as tr} from "./i18n.mjs";
import {promises as fs,createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {stopChild} from './motor-lifecycle.mjs';
export const LOCAL_MODEL='earia-local';
export class MotorProgress {
 constructor(){this.state={phase:'idle',percent:null,message:tr('Nincs elindítva'),startedAt:null,lastActivityAt:null};}
 begin(){this.state={phase:'starting',percent:null,message:tr('Motor indítása…'),startedAt:Date.now(),lastActivityAt:Date.now()};}
 activity(){this.state.lastActivityAt=Date.now();}
 update(data){
  this.activity();
  if(data.status==='unloaded'){this.fail(tr('A modellfolyamat leállt. Részletek: logs/model.log.'));return;}
  if(data.status==='loading'){
   const value=data.progress?.value;
   if(typeof value==='number'&&Number.isFinite(value)){
    this.state.percent=Math.round(Math.max(0,Math.min(1,value))*100);
    this.state.phase=this.state.percent===100?'initializing':'loading';
    this.state.message=this.state.percent===100?tr('Súlyok betöltve · végső előkészítés…'):tr('Modellsúlyok betöltése…');
   }else if(this.state.percent===null){this.state.phase='loading';this.state.message=tr('Modell betöltése…');}
  }
 }
 ready(){this.activity();Object.assign(this.state,{phase:'ready',percent:100,message:tr('A modell betöltődött, használatra kész.')});}
 fail(message){this.activity();Object.assign(this.state,{phase:'error',message});}
}
export function parseMotorEvents(buffer,onEvent){
 const frames=buffer.replace(/\r\n/g,'\n').split('\n\n');const rest=frames.pop();
 for(const frame of frames){const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;try{onEvent(JSON.parse(data));}catch{}}
 return rest;
}
export class LocalMotor {
 constructor({root,port,key,fetcher=fetch,spawner=spawn}){Object.assign(this,{root,port,key,fetcher,spawner});this.child=null;this.progress=new MotorProgress();this.abort=null;this.stopping=false;}
 get active(){return Boolean(this.child);}
 status(){return {ready:this.progress.state.phase==='ready',status:this.progress.state.message,loading:{...this.progress.state}};}
 async request(resource,options={}){return this.fetcher(`http://127.0.0.1:${this.port}${resource}`,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.key,...options.headers},signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(options.timeout??4000)])});}
 async start(config){
  if(this.active)return this.status();
  await fs.access(config.modelPath);await fs.access(config.runtimePath);
  if(/[\r\n]/.test(config.modelPath))throw Error(tr('Érvénytelen modellútvonal.'));
  const preset=path.join(this.root,'logs','local-model.ini');
  await fs.writeFile(preset,`version = 1\n[${LOCAL_MODEL}]\nmodel = ${path.resolve(config.modelPath).replace(/\\/g,'/')}\nload-on-startup = false\n`, 'utf8');
  this.stopping=false;this.abort=new AbortController();this.progress.begin();
  const logs=createWriteStream(path.join(this.root,'logs','model.log'),{flags:'a'});
  const child=this.spawner(config.runtimePath,['--models-preset',preset,'--no-models-autoload','--models-max','1','--host','127.0.0.1','--port',String(this.port),'-c',String(config.contextSize),'-ngl',String(config.gpuLayers),'-b','256','-ub','128','--load-mode','none','--jinja','--reasoning-budget','0','--parallel','1','--api-key',this.key],{cwd:path.dirname(config.runtimePath),windowsHide:true,stdio:['ignore','pipe','pipe']});
  this.child=child;
  for(const stream of [child.stdout,child.stderr]){stream.pipe(logs,{end:false});stream.on('data',()=>this.progress.activity());}
  child.on('error',()=>{if(!this.stopping)this.progress.fail(tr('A modellmotor nem indítható. Ellenőrizd a futtató útvonalát.'));});
  child.on('close',code=>{if(this.child===child){this.child=null;if(!this.stopping)this.progress.fail(`${tr("A motor leállt (")}${code}${tr("). Részletek: logs/model.log.")}`);}logs.end();});
  this.work=this.load().catch(error=>{if(!this.stopping&&!this.abort.signal.aborted)this.progress.fail(error.message);});
  return this.status();
 }
 async events(){
  try{const r=await this.fetcher(`http://127.0.0.1:${this.port}/models/sse`,{headers:{Authorization:'Bearer '+this.key},signal:this.abort.signal});if(!r.ok)return;
   let buffer='';const decoder=new TextDecoder();for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});buffer=parseMotorEvents(buffer,e=>{if(e.model===LOCAL_MODEL&&['model_status','status_change'].includes(e.event))this.progress.update(e.data||{});});if(buffer.length>100000)buffer='';}
  }catch{}
 }
 async load(){
  const start=Date.now();let available=false;
  while(Date.now()-start<60000&&!this.abort.signal.aborted){if(!this.active)throw Error(this.status().status);try{const r=await this.request('/models');if(r.ok&&(await r.json()).data?.some(m=>m.id===LOCAL_MODEL)){available=true;break;}}catch{}await this.pause(300);}
  if(!available)throw Error(tr('A modellmotor nem vált elérhetővé 60 másodpercen belül. Részletek: logs/model.log.'));
  this.eventTask=this.events();
  let loadError=null;
  const loading=this.request('/models/load',{method:'POST',body:JSON.stringify({model:LOCAL_MODEL}),timeout:600000}).then(async r=>{if(!r.ok)loadError=Error(tr('A modell betöltése sikertelen. Ellenőrizd a memóriát és a logs/model.log fájlt.'));}).catch(()=>{loadError=Error(tr('Megszakadt a motorral a kapcsolat betöltés közben.'));});
  while(Date.now()-start<600000&&!this.abort.signal.aborted){
   if(loadError)throw loadError;
   try{const r=await this.request('/models');if(r.ok){const m=(await r.json()).data?.find(m=>m.id===LOCAL_MODEL);if(m?.status?.failed)throw Error(tr('A modellfolyamat hibával leállt. Részletek: logs/model.log.'));
    if(m?.status?.value==='loaded'){
     const ready=await this.request('/props?model='+LOCAL_MODEL+'&autoload=false');
     if(ready.ok){this.progress.ready();return;}
    }else if(m?.status?.value==='loading')this.progress.update({status:'loading',...(m.status.progress?{progress:m.status.progress}:{})});
   }}catch(e){if(e.message.includes(tr('hibával leállt')))throw e;}
   await this.pause(500);
  }
  void loading;
  if(!this.abort.signal.aborted)throw Error(tr('A modell 10 perc alatt sem lett használatra kész. A Leállítás gombbal megszakíthatod; részletek: logs/model.log.'));
 }
 async pause(ms){if(this.abort.signal.aborted)throw Error(tr('Betöltés megszakítva.'));await new Promise(r=>setTimeout(r,ms));}
 async waitReady(timeout=600000){const start=Date.now();while(this.active&&Date.now()-start<timeout){const s=this.status();if(s.ready)return;if(s.loading.phase==='error')throw Error(s.status);await new Promise(r=>setTimeout(r,500));}throw Error(this.status().status);}
 async stop(){
  this.stopping=true;this.abort?.abort();const child=this.child;
  if(child&&child.exitCode===null){
   if(process.platform==='win32')await new Promise((resolve,reject)=>execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},error=>{if(error&&child.exitCode===null)reject(Error(tr('A modellmotor nem állt le.')));else resolve();}));
   else await stopChild(child);
  }
  await this.work;await this.eventTask;
  this.child=null;this.progress.state={phase:'idle',percent:null,message:tr('A motor leállítva.'),startedAt:null,lastActivityAt:Date.now()};
 }
}
