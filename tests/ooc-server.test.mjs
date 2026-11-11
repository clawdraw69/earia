import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
test('OOC API: karakterfájl, mentés, privát terv, backup és újratöltés',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'earia-ooc-')),port=43217;
 const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,EARIA_LANGUAGE:'hu',EARIA_SAVES:temp,EARIA_PORT:String(port)},stdio:'pipe'});
 const api=async(p,data)=>{const r=await fetch(`http://127.0.0.1:${port}/api${p}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;};
 try{
  for(let i=0;i<60;i++){try{await api('/status');break;}catch{await delay(100);}}
  const g=await api('/games',{player:{name:'Grom',age:50,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3],orientation:3,blessings:[]}});
  const file=path.join(temp,g.id,'game.json'),saved=JSON.parse(await fs.readFile(file,'utf8'));saved.started=true;saved.summary='Grom szeme kék.';saved.privateStory={plan:'Grom szeme kék.'};await fs.writeFile(file,JSON.stringify(saved));
  const result=await api(`/games/${g.id}/chat`,{text:'OOC: Grom szeme legyen aranyszínű'});
  assert.equal(result.characters[0].appearanceFacts.eyeColor,'aranyszínű');assert.equal('adminState' in result,false);assert.equal('privateStory' in result,false);assert.equal(result.messages.at(-1).source,'ooc-admin');
  const mirror=JSON.parse(await fs.readFile(path.join(temp,g.id,'player','character.json'),'utf8'));assert.equal(mirror.appearanceFacts.eyeColor,'aranyszínű');
  const disk=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(disk.summary,'');assert.equal(disk.privateStory.plan,'');assert.equal((await fs.readdir(path.join(temp,g.id,'ooc-backups'))).length,1);
  const reload=await api(`/games/${g.id}`);assert.equal(reload.characters[0].appearanceFacts.eyeColor,'aranyszínű');
 }finally{proc.kill();await delay(200);await fs.rm(temp,{recursive:true,force:true});}
});
