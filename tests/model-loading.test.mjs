import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MotorProgress,parseMotorEvents} from '../local-motor.mjs';
import {loadingView,showModelLoading} from '../public/model-loading.js';
test('Valódi százalék nem jelent automatikus kész állapotot',()=>{
 const p=new MotorProgress();p.begin();assert.equal(p.state.percent,null);
 p.update({status:'loading',progress:{value:.37}});assert.equal(p.state.percent,37);
 p.update({status:'loading',progress:{value:1}});assert.equal(p.state.phase,'initializing');
 p.update({status:'loading'});assert.equal(p.state.phase,'initializing');
 p.ready();assert.equal(p.state.phase,'ready');assert.equal(p.state.percent,100);
 p.fail('hiba');assert.equal(p.state.phase,'error');
});
test('Darabolt SSE-adatból százalék és kész esemény olvasható',()=>{
 const rows=[];let buffer='data: {"model":"earia-local","event":"model_status","data":{"status":"loading","progress":{"value":0.';
 buffer=parseMotorEvents(buffer,e=>rows.push(e));assert.equal(rows.length,0);
 buffer+='5}}}\r\n\r\ndata: {"data":{"status":"loaded"}}\n\n';buffer=parseMotorEvents(buffer,e=>rows.push(e));assert.equal(rows.length,2);assert.equal(rows[0].data.progress.value,.5);assert.equal(buffer,'');
});
test('A töltőképernyő időt és motorjelzést ad százalék nélkül is',()=>{
 const v=loadingView({status:'Motor indítása',loading:{phase:'starting',percent:null,startedAt:1000,lastActivityAt:61000}},66000);
 assert.equal(v.percent,null);assert.equal(v.time,'Eltelt idő: 1:05');assert.match(v.activity,/5 másodperce/);
});
test('Indítás bezárja a beállításokat, és a képernyő csak a kész válaszra vált sikeresre',async()=>{
 const original=globalThis.document,nodes=new Map();let closed=false,removed=false,notified=false,calls=0;
 const element=()=>({textContent:'',hidden:false,disabled:false,value:null,focus(){},removeAttribute(name){if(name==='value')this.value=null;}});
 const panel={setAttribute(){},classList:{add(){}},remove(){removed=true;},querySelector(key){if(!nodes.has(key))nodes.set(key,element());return nodes.get(key);}};
 globalThis.document={getElementById:()=>({close(){closed=true;}}),createElement:()=>panel,body:{append(){}}};
 try{
  await showModelLoading({notify:()=>{notified=true;},api:async route=>{assert.equal(closed,true);if(route==='/ai/start')return {ready:false,status:'Indítás',loading:{phase:'starting',percent:null}};calls++;return calls===1?{ready:false,status:'Előkészítés',loading:{phase:'initializing',percent:100}}:{ready:true,status:'Kész',loading:{phase:'ready',percent:100}};}});
  assert.equal(calls,2);assert.equal(notified,true);assert.equal(nodes.get('progress').value,100);assert.equal(nodes.get('.load-stop').hidden,true);assert.equal(nodes.get('.load-close').hidden,false);
  nodes.get('.load-close').onclick();assert.equal(removed,true);
 }finally{globalThis.document=original;}
});
test('A Leállítás megszakítja a betöltőképernyő figyelését',async()=>{
 const original=globalThis.document,nodes=new Map();let stopped=false;
 const panel={setAttribute(){},classList:{add(){}},remove(){},querySelector(key){if(!nodes.has(key))nodes.set(key,{hidden:false,focus(){},removeAttribute(){}});return nodes.get(key);}};
 globalThis.document={getElementById:()=>({close(){}}),createElement:()=>panel,body:{append(){}}};
 try{
  await showModelLoading({notify(){},api:async route=>{if(route==='/ai/start'){setTimeout(()=>nodes.get('.load-stop').onclick(),0);return {ready:false,status:'Töltés',loading:{phase:'loading',percent:15}};}if(route==='/ai/stop'){stopped=true;return {ok:true};}throw Error('Stop után nem várunk további állapotot.');}});
  assert.equal(stopped,true);assert.match(nodes.get('.load-message').textContent,/leállítottad/);assert.equal(nodes.get('.load-close').hidden,false);
 }finally{globalThis.document=original;}
});
