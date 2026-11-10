import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {persistGame,atomicJson} from '../storage.mjs';
import {validMessages,appendNonempty,appendOocAnswer} from '../ai-state.mjs';
import {narratorTurn} from '../narrator.mjs';
import {applyOocPlan,directOocPlan} from '../ooc.mjs';
import {stopChild} from '../motor-lifecycle.mjs';
function fixture(){return {playerId:'t',characters:[{id:'t',name:'Tob',clan:'Wulf',sex:'male',age:21,stats:[9,8,9,10,9,8,10],description:'Fekete bundájú, kék szemű, magányos férfi.'},{id:'m',name:'Matt',clan:'Wulf',sex:'male',age:40,stats:[10,10,10,10,10,6,10],description:'Szürke bundájú.'}],setup:{relationships:'Tob és Matt nem ismerik egymást.'},messages:[],memories:[],summary:'',privateStory:{secret:'titkos tesztadat'},minutes:0,scene:{active:false},coreFacts:['A kapu zárva.']};}
test('Tob leírás-kérése a modellhez megy, a karakterek a promptban',()=>{
 const g=fixture(),text='végigmérem Mattet. még nem is beszéltem vele. mit látok?';
 const turn=narratorTurn(g,text);assert.equal(turn.appearanceOnly,false);
 assert.match(turn.prompt,/végigmérem Mattet/);assert.match(turn.prompt,/Matt/);
 const prompt=narratorTurn(g,'Bemutatkozom.').prompt;assert.match(prompt,/nem ismerik egymást/);assert.match(prompt,/A kapu zárva/);
});
test('A szerzői leírás többi tulajdonsága nem vész el OOC szemszín javításkor',()=>{
 const g=fixture(),text='Tob szeme legyen aranyszínű',next=applyOocPlan(g,text,directOocPlan(g,text)).game;
 assert.equal(next.characters[0].description,g.characters[0].description);assert.equal(next.characters[0].appearanceFacts.eyeColor,'aranyszínű');
 assert.match(narratorTurn(next,'Folytassuk.').prompt,/felülírja a régebbi authorDescription/);
});
test('Üres és ismételt AI-emlékek kimaradnak; a játékos nem lehet AI-beszélő',()=>{
 const list=[];for(const text of ['', '  ','egy emlék','egy emlék'])appendNonempty(list,text,500);assert.deepEqual(list,['egy emlék']);
 assert.throws(()=>validMessages({messages:[{speaker:'t',text:'Én döntöttem.'}]},fixture()));
});
test('OOC válasz sem időt, sem történetadatot nem ír át',()=>{
 const g=fixture(),before=structuredClone(g);
 appendOocAnswer(g,{messages:[{speaker:'narrator',text:'Válasz.'}],elapsedMinutes:400,summary:'téves',memory:'téves',privateUpdate:'téves'},'HOL VAGYUNK?');
 assert.equal(g.minutes,before.minutes);assert.deepEqual(g.privateStory,before.privateStory);assert.deepEqual(g.memories,[]);assert.equal(g.summary,'');assert.equal(g.messages.at(-1).source,'ooc-answer');assert.doesNotMatch(narratorTurn(fixture(),'HOL VAGYUNK?',true).prompt,/titkos tesztadat/);
});
test('Mentési hiba: kanonikus fájl érintetlen; tükörhiba: új fő mentés érvényes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'earia-commit-'));
 const g={...fixture(),playerId:'11111111-1111-1111-1111-111111111111'};g.characters=[{...g.characters[0],id:g.playerId}];
 try{
  await persistGame(dir,g);const before=await fs.readFile(path.join(dir,'game.json'),'utf8');
  await assert.rejects(persistGame(dir,{...g,summary:'nem menthető'},{atomic:async()=>{throw Error('disk');}}));assert.equal(await fs.readFile(path.join(dir,'game.json'),'utf8'),before);
  const warnings=await persistGame(dir,{...g,summary:'új állapot'},{atomic:async(file,data)=>{if(file.endsWith('character.json'))throw Error('mirror');await atomicJson(file,data);},onMirrorError:()=>{}});
  assert.equal(warnings.length,1);assert.equal(JSON.parse(await fs.readFile(path.join(dir,'game.json'),'utf8')).summary,'új állapot');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Motor leállítás megvárja az exit eseményt, hibát jelez időtúllépéskor',async()=>{
 const child=new EventEmitter();child.exitCode=null;let killed=false,finished=false;child.kill=()=>{killed=true;};
 const stopping=stopChild(child,200).then(()=>finished=true);assert.equal(killed,true);await Promise.resolve();assert.equal(finished,false);child.emit('exit',0);await stopping;assert.equal(finished,true);
 await assert.rejects(stopChild(child,10),/nem állt le/);
});
