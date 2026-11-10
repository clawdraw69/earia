// Manual GPU smoke test. Isolated save; no narrator or paid API calls.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=await fs.mkdtemp(path.join(process.env.EARIA_TEST_TMP||os.tmpdir(),'earia-image-live-'));
const model=process.argv.includes('--pony')?'pony-v6-xl':'sd15';
const id='33333333-3333-4333-8333-333333333333',port=43239;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await fs.mkdir(path.join(dir,id));await fs.writeFile(path.join(dir,id,'game.json'),JSON.stringify({id,title:'Képteszt',playerId:'p',characters:[{id:'p',name:'Teszt',age:25,sex:'male',clan:'Ursa',stats:[5,5,5,5,5,5,5],state:{vf:1,vn:1},blessings:[]}],minutes:0,location:'Forest',summary:'A quiet forest at sunrise.',memories:[],messages:[],privateStory:{},setup:{},scene:{active:false,round:0,members:[]},started:true,updatedAt:new Date().toISOString()}));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,EARIA_PORT:String(port),EARIA_SAVES:dir},stdio:['ignore','pipe','pipe']});child.stderr.pipe(process.stderr);
async function api(s,data){const r=await fetch(`http://127.0.0.1:${port}/api${s}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
try{
 for(let i=0;i<60;i++){try{await api('/status');break;}catch{await pause(200);}}
 assert.equal((await fetch(`http://127.0.0.1:${port}/image-panel.js`)).status,200);
 const job=await api(`/images/${id}/generate`,{model,prompt:'A cozy medieval tavern interior, warm lantern light, wooden tables, fireplace, detailed fantasy painting',width:model==='sd15'?512:768,height:model==='sd15'?512:768,seed:42,steps:20});
 const started=Date.now();let state,last;
 while(Date.now()-started<600000){state=await api(`/images/${id}`);if(state.job.phase!==last){last=state.job.phase;console.log(last,state.job.message);}
  if(state.job.phase==='error')throw Error(state.job.message);if(state.job.phase==='done')break;await pause(1000);
 }
 assert.equal(state.job.phase,'done');const saved=await api(`/images/${id}/accept`,{jobId:job.id});assert.equal(saved.file,'001.png');
 assert.deepEqual(await api(`/images/${id}/accept`,{jobId:job.id}),saved);
 const response=await fetch(`http://127.0.0.1:${port}${saved.url}`);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');
 await fs.writeFile(path.join(root,'image-gen',model+'-proba.png'),bytes);
 const generatedSeconds=Math.round((Date.now()-started)/1000);
 await api(`/images/${id}/generate`,{model,prompt:'A quiet mountain lake',steps:40,width:model==='sd15'?512:768,height:model==='sd15'?512:768});
 const cancelStart=Date.now();let cancelState;
 while(Date.now()-cancelStart<120000){cancelState=await api(`/images/${id}`);if(cancelState.job.phase==='generating')break;if(['error','done'].includes(cancelState.job.phase))throw Error('Nem sikerült mintavételezés közben megszakítani: '+cancelState.job.message);await pause(200);}
 assert.equal(cancelState.job.phase,'generating');await api(`/images/${id}/cancel`,{});
 const cancelled=await api(`/images/${id}`);assert.equal(cancelled.job.phase,'cancelled');assert.equal(cancelled.busy,false);
 const evidence={date:new Date().toISOString(),model,generated:true,numberedSave:saved.file,bytes:bytes.length,seconds:generatedSeconds,cancelled:true,cancelledDuringSampling:true,paidApiCalls:0};
 await fs.writeFile(path.join(root,'image-gen',model+'-live-test.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{try{await api('/quit',{});}catch{child.kill();}await pause(1000);await fs.rm(dir,{recursive:true,force:true});}
