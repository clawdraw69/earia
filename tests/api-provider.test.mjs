import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {API_DEFAULTS,apiBase,publicConfig,remoteInfer} from '../api-provider.mjs';
import {nextSettings} from '../settings.mjs';
test('API kulcs elrejtése, végpontváltás és hibás válasz elutasítása',async()=>{
 assert.equal(publicConfig({...API_DEFAULTS,apiKeyEncrypted:'secret'}).apiKeyEncrypted,undefined);
 assert.throws(()=>apiBase('http://example.com'));assert.throws(()=>apiBase('https://user:pass@example.com'));
 const c={...API_DEFAULTS,apiKeyEncrypted:'cipher',modelPath:'x',runtimePath:'y',contextSize:8192,gpuLayers:0};
 await assert.rejects(nextSettings(c,{provider:'api',apiBaseUrl:'https://other.example'}),/kulcsot/);
 assert.equal((await nextSettings(c,{provider:'api',apiKey:''})).apiKeyEncrypted,'cipher');
 await assert.rejects(remoteInfer(c,'fake','system','user',{type:'object',properties:{ok:{type:'boolean'}},required:['ok']},{fetcher:async()=>new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}))}),/adatsémájának/);
});
test('API teljes út: titkosított kulcs, kapcsolat, kezdés, chat, hiba és helyi visszaváltás',{skip:process.platform!=='win32'},async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'earia-api-'));let child,fail=false,calls=0;
 const mock=http.createServer(async(req,res)=>{
  assert.equal(req.headers.authorization,'Bearer dummy-test-key');res.setHeader('Content-Type','application/json');
  if(req.url==='/models')return res.end(JSON.stringify({data:[{id:'test-model'}]}));
  calls++;if(fail){res.statusCode=402;return res.end('{}');}
  let input='';for await(const chunk of req)input+=chunk;const b=JSON.parse(input);assert.equal(b.model,'test-model');assert.equal(b.chat_template_kwargs,undefined);
  const schema=JSON.parse(b.messages[1].content.split('A kötelező JSON-séma: ')[1]);
  const data={messages:[{speaker:'narrator',text:'Az ajtó mellett egy lámpás világít.'}],summary:'Lámpás az ajtónál.',location:'Fogadó',elapsedMinutes:1,choices:['Várok.','Körülnézek.'],memory:'',privateUpdate:'',events:[],desireEvents:[],candidate:null};
  if(schema.properties.privatePlan){data.privatePlan={objective:'Beszélgetés',secrets:'Egy levél',possibleEvents:'Vendég érkezik'};data.initialStates=schema.properties.initialStates.items.properties.id.enum.map(id=>({id,vf:1,vn:1}));}
  res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]}));
 });await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 const port=43221,base=`http://127.0.0.1:${port}/api`;
 const api=async(p,data)=>{const r=await fetch(base+p,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 try{
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,EARIA_PORT:String(port),EARIA_SAVES:path.join(temp,'saves'),EARIA_CONFIG:path.join(temp,'config.json')},windowsHide:true,stdio:'ignore'});
  for(let i=0;i<60;i++){try{await api('/status');break;}catch{await delay(100);}}
  const configured=await api('/settings',{provider:'api',apiBaseUrl:`http://127.0.0.1:${mock.address().port}`,apiModel:'test-model',apiKey:'dummy-test-key'});assert.equal(configured.status,200,JSON.stringify(configured.data));
  const disk=await fs.readFile(path.join(temp,'config.json'),'utf8');assert.ok(!disk.includes('dummy-test-key'));assert.ok(JSON.parse(disk).apiKeyEncrypted);
  const status=(await api('/status')).data;assert.equal(status.config.hasApiKey,true);assert.equal(status.config.apiKeyEncrypted,undefined);
  assert.equal((await api('/ai/check',{})).status,200);
  const created=await api('/games',{player:{name:'Teszt',age:25,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3],orientation:5,blessings:[]}}),id=created.data.id;
  assert.equal((await api(`/games/${id}/setup`,{location:'Fogadó',relationships:'',idea:'Beszélgetés'})).status,200);
  assert.equal((await api(`/games/${id}/chat`,{text:'Körülnézek.'})).status,200);assert.equal(calls,2);
  const before=await fs.readFile(path.join(temp,'saves',id,'game.json'),'utf8');fail=true;
  assert.equal((await api(`/games/${id}/chat`,{text:'Várok.'})).status,400);assert.equal(await fs.readFile(path.join(temp,'saves',id,'game.json'),'utf8'),before);
  assert.equal((await api('/settings',{provider:'local',clearApiKey:true})).status,200);assert.equal((await api('/status')).data.config.hasApiKey,false);
 }finally{child?.kill();await delay(200);await new Promise(r=>mock.close(r));await fs.rm(temp,{recursive:true,force:true});}
});
