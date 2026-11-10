import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deleteSave} from '../delete-save.mjs';
import {confirmSaveDeletion} from '../public/save-delete.js';
test('Mentéstörlés: a Mégse nem hív API-t, a megerősítés a megnevezett mentéshez tartozik',async()=>{
 const save={id:'one',title:'Baal története',player:'Baal'};let calls=0;
 assert.equal(await confirmSaveDeletion(save,{confirm:message=>{assert.match(message,/Baal története/);assert.match(message,/végleg/);return false;},remove:()=>calls++}),false);assert.equal(calls,0);
 assert.equal(await confirmSaveDeletion(save,{confirm:()=>true,remove:async(id,b)=>{calls++;assert.equal(id,save.id);assert.deepEqual(b,{confirmed:true,confirmationId:save.id});}}),true);assert.equal(calls,1);
});
test('Mentéstörlés: megerősítés és zár nélkül kizárólag a célmappát törli',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'earia-delete-')),id='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',locks=new Set();
 try{
  for(const key of [id,other]){await fs.mkdir(path.join(root,key,'npcs','npc'),{recursive:true});await fs.mkdir(path.join(root,key,'images'));await fs.writeFile(path.join(root,key,'game.json'),'{}');await fs.writeFile(path.join(root,key,'npcs','npc','avatar.jpg'),'test');}
  const confirmation={confirmed:true,confirmationId:id};
  await assert.rejects(deleteSave(root,id,{},locks),/erősítened/);await fs.access(path.join(root,id,'game.json'));
  await assert.rejects(deleteSave(root,id,{...confirmation,confirmationId:other},locks),/erősítened/);
  locks.add(id);await assert.rejects(deleteSave(root,id,confirmation,locks),/frissül/);locks.clear();
  await assert.rejects(deleteSave(root,'../outside',{confirmed:true,confirmationId:'../outside'},locks),/azonosító/);
  await deleteSave(root,id,confirmation,locks);await assert.rejects(fs.access(path.join(root,id)));await fs.access(path.join(root,other,'game.json'));assert.equal(locks.size,0);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
