import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {visualCharacter,imageContext,selectedCharacters,referenceFiles,attachCharacterImage} from '../character-images.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const character=(id,name)=>({id,name,age:30,sex:'male',clan:'Ursa',stats:[7,6,5,5,5,5,5],description:'Barna bunda',appearanceFacts:{eyeColor:'arany'}});
test('Képkontextus: szereplők, sorrend, megjelenés, friss cselekvés; privát terv nélkül',()=>{
 const g={playerId:A,characters:[character(A,'Baal'),character(B,'Grom')],location:'Barlang',summary:'Korábbi esemény',messages:[{speaker:A,text:'Szia'}],privateStory:'SECRET'};
 const ctx=imageContext(g,{characterIds:[B,A],action:'Ölelkeznek'});
 assert.equal(ctx.characters[0].name,'Grom');assert.equal(ctx.characters[0].position,'left');assert.equal(ctx.action,'Ölelkeznek');
 assert.equal(ctx.characters[1].appearanceFacts.eyeColor,'arany');assert.equal(ctx.characters[0].build,'very heavyset, huge round belly');assert.ok(!JSON.stringify(ctx).includes('SECRET'));
 assert.equal(imageContext(g,{characterId:A}).mode,'character');assert.throws(()=>selectedCharacters(g,{characterIds:[A,A]}));assert.throws(()=>selectedCharacters(g,{characterIds:['../x']}));
 assert.match(visualCharacter({...g.characters[0],sex:'female'}).species,/human woman/);
});
test('Karakterreferencia és avatár a saját mappában; hiányzó vagy idegen referencia elutasítása',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'earia-refs-'));
 try{
  const a=character(A,'Baal'),b=character(B,'Grom'),g={playerId:A,characters:[a,b]};
  await assert.rejects(referenceFiles(root,g,[a]),/előbb fogadj/);
  const png=Buffer.from('PNG fixture'),jpeg=Buffer.from([255,216,255,217]).toString('base64');
  const args={png,jpeg,saved:{file:'001.png',prompt:'bear',model:'pony-v6-xl'},snapshot:visualCharacter(a)};
  await attachCharacterImage(root,g,a,args);await attachCharacterImage(root,g,b,args);
  const files=await referenceFiles(root,g,[a,b]);assert.equal(path.dirname(files[0]),path.join(root,'player'));assert.equal(path.dirname(files[1]),path.join(root,'npcs',B));
  assert.deepEqual(await fs.readFile(files[0]),png);assert.deepEqual(await fs.readFile(path.join(root,'player','avatar.jpg')),Buffer.from(jpeg,'base64'));
  b.visual.referenceFile='../outside.png';await assert.rejects(referenceFiles(root,g,[b]),/előbb fogadj/);
  await assert.rejects(attachCharacterImage(root,g,a,{...args,jpeg:'bad'}),/JPEG/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('Képkontextus: vágy, arousál és explicit jelzés a jelenethez',()=>{
 const a=character(A,'Baal'),b=character(B,'Grom');
 a.state={vf:1,vn:4.4};b.state={vf:5,vn:1};
 const scene={active:true,round:3,members:[{id:A,contacts:{vaginal:1},directions:['female'],completed:false},{id:B,contacts:{vaginal:1},directions:['male'],completed:false}]};
 const g={playerId:A,characters:[a,b],location:'Barlang',summary:'',messages:[{speaker:'narrator',text:'A fasz a puncijához ér.'}],scene};
 const explicit=imageContext(g,{characterIds:[A,B],action:'Szeretkeznek'});
 assert.equal(explicit.explicitness,'explicit');
 assert.equal(explicit.scene.round,3);
 assert.equal(explicit.characters[0].desire.arousal,'wet');
 assert.equal(explicit.characters[0].penis,'large');
 const calm={...g,scene:{active:false},messages:[{speaker:'narrator',text:'A szél fúj a fenyők között.'}]};
 assert.equal(imageContext(calm,{characterIds:[A,B]}).explicitness,'suggestive');
 assert.equal(imageContext({...g,scene:{active:false}},{characterIds:[A,B]}).explicitness,'explicit');
 assert.equal(imageContext(g,{characterId:A}).explicitness,'suggestive');
});
test('A teltség 1–7 minden fokozata más testalkatot ad',()=>{
 const base=character(A,'Baal');
 const words=[1,2,3,4,5,6,7].map(v=>visualCharacter({...base,stats:[v,6,5,5,5,5,5]}).build);
 assert.equal(new Set(words).size,7);
 assert.match(words[0],/very lean/);
 assert.match(words[3],/average build/);
 assert.match(words[6],/very heavyset/);
});
