// Manual GPU integration test, isolated saves, no paid API calls.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'earia-character-live-'));
const id='44444444-4444-4444-8444-444444444444',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',port=43249;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const chars=[a,b].map((id,i)=>({id,name:i?'Fox':'Bear',age:35,sex:'male',clan:i?'Vulpi':'Ursa',stats:[6,5,5,5,5,5,5],state:{vf:1,vn:1},blessings:[]}));
await fs.mkdir(path.join(dir,id));await fs.writeFile(path.join(dir,id,'game.json'),JSON.stringify({id,title:'Karakterképteszt',playerId:a,characters:chars,minutes:0,location:'Meadow',summary:'Friends meeting',memories:[],messages:[],privateStory:{},setup:{},scene:{active:false,round:0,members:[]},started:true,updatedAt:new Date().toISOString()}));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,EARIA_PORT:String(port),EARIA_SAVES:dir},stdio:['ignore','pipe','pipe']});child.stderr.pipe(process.stderr);
async function api(s,data){const r=await fetch(`http://127.0.0.1:${port}/api${s}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
async function generate(input){const job=await api(`/images/${id}/generate`,{model:'pony-v6-xl',width:768,height:768,steps:20,seed:77,...input});let state,last;const start=Date.now();
 while(Date.now()-start<600000){state=await api(`/images/${id}`);if(state.job.phase!==last){last=state.job.phase;console.log(last,state.job.message);}if(state.job.phase==='error')throw Error(state.job.message);if(state.job.phase==='done')return state.job;await pause(1000);}throw Error('Generation timeout');}
try{
 for(let i=0;i<60;i++){try{await api('/status');break;}catch{await pause(200);}}
 const proof=path.join(root,'image-gen','character-test');await fs.mkdir(proof,{recursive:true});
 for(const [index,characterId] of [a,b].entries()){
  const job=await generate({characterId,width:768,height:1024,seed:43,negative:'multiple characters, multiple views, duplicate, twins, cropped head, blurry, text, watermark',prompt:index?'solo, single character, full body illustration of one adult anthropomorphic orange fox man, green tunic and brown trousers, standing, head visible, neutral gray background':'solo, single character, full body illustration of one adult anthropomorphic brown bear man, heavyset, blue tunic and brown trousers, standing, head visible, neutral gray background'});
  const bytes=Buffer.from(await (await fetch(`http://127.0.0.1:${port}${job.previewUrl}`)).arrayBuffer());const file=path.join(proof,index?'fox.png':'bear.png');await fs.writeFile(file,bytes);
  const jpeg=execFileSync(path.join(root,'image-gen/.venv/Scripts/python.exe'),['-c','from PIL import Image; import sys,io,base64; im=Image.open(sys.argv[1]); im=im.crop((180,0,590,410)).resize((512,512)); b=io.BytesIO(); im.convert("RGB").save(b,format="JPEG"); print(base64.b64encode(b.getvalue()).decode())',file],{encoding:'utf8'}).trim();
  const game=await api(`/images/${id}/reference`,{jobId:job.id,jpeg});assert.ok(game.characters.find(c=>c.id===characterId).visual.referenceFile);
 }
 for(const model of (process.argv.includes('--pony-only')?['pony-v6-xl']:['pony-v6-xl','sd15'])){
  const job=await generate({model,width:model==='sd15'?512:768,height:model==='sd15'?512:768,characterIds:[a,b],referenceStrength:.65,prompt:'Two adult anthropomorphic men hugging, brown bear in blue tunic on left, orange fox in green tunic on right, grassy meadow, warm daylight, full body fantasy illustration'});
  const saved=await api(`/images/${id}/accept`,{jobId:job.id});assert.equal(saved.references.length,2);
  const bytes=Buffer.from(await (await fetch(`http://127.0.0.1:${port}${saved.url}`)).arrayBuffer());await fs.writeFile(path.join(proof,model+'-hug.png'),bytes);
 }
 const restored=await api(`/games/${id}`);assert.ok(restored.characters.every(c=>c.visual.referenceFile));
 await fs.writeFile(path.join(proof,'result.json'),JSON.stringify({date:new Date().toISOString(),characterReferences:2,models:process.argv.includes('--pony-only')?['pony-v6-xl']:['pony-v6-xl','sd15'],avatarsSaved:true,paidApiCalls:0},null,2));console.log('PASS: character images, avatar, two-reference scene; '+(process.argv.includes('--pony-only')?'Pony':'Pony and SD1.5'));
}finally{try{await api('/quit',{});}catch{child.kill();}await pause(1000);await fs.rm(dir,{recursive:true,force:true});}
