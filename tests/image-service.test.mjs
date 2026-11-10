import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {ImageService,imageOptions} from '../image-service.mjs';
const ID='11111111-1111-4111-8111-111111111111';
const ID2='22222222-2222-4222-8222-222222222222';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
test('Képbeállítás: seed, méret és hibás értékek',()=>{
 assert.equal(imageOptions({prompt:'Forest',seed:0}).seed,0);
 assert.throws(()=>imageOptions({prompt:''}));assert.throws(()=>imageOptions({prompt:'Forest',width:768,height:768}));
 assert.throws(()=>imageOptions({prompt:'Forest',seed:1.2}));assert.throws(()=>imageOptions({prompt:'Forest',steps:100}));
 assert.equal(imageOptions({model:'pony-v6-xl',prompt:'Forest',width:768,height:768}).model,'pony-v6-xl');
 assert.throws(()=>imageOptions({model:'unknown',prompt:'Forest'}));
});
test('Helyi képek: folyamat, izoláció, 001-es mentés, idempotencia és megszakítás',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'earia-images-')),saves=path.join(root,'saves');let child;
 const spawner=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.signalCode=null;child.kill=()=>{child.signalCode='SIGTERM';child.emit('exit',null,'SIGTERM');child.emit('close',null);};return child;};
 const svc=new ImageService({root,saves,spawner});
 try{
  for(const id of [ID,ID2]){await fs.mkdir(path.join(saves,id),{recursive:true});await fs.writeFile(path.join(saves,id,'game.json'),'{}');}
  for(const name of ['logs','image-gen/.venv/Scripts','image-gen/models/sd15'])await fs.mkdir(path.join(root,name),{recursive:true});
  for(const name of ['image-gen/.venv/Scripts/python.exe','image-gen/models/sd15/model_index.json','image-gen/models/source.json'])await fs.writeFile(path.join(root,name),'{}');
  assert.deepEqual((await svc.availableModels()).map(m=>m.id),['sd15']);
  await assert.rejects(svc.generate(ID,{model:'pony-v6-xl',prompt:'Forest'}),/nincs teljesen/);
  await assert.rejects(svc.directory('../outside'));
  const job=await svc.generate(ID,{prompt:'A quiet forest',seed:12});
  await assert.rejects(svc.generate(ID2,{prompt:'Castle'}),/Már készül/);
  child.stdout.write(JSON.stringify({phase:'generating',percent:50,message:'Halfway'})+'\n');
  assert.equal(svc.publicJob(svc.jobs.get(ID)).percent,50);
  await assert.rejects(svc.accept(ID,job.id),/Nincs menthető/);
  await fs.writeFile(svc.jobs.get(ID).output,png);child.stdout.write(JSON.stringify({phase:'done',percent:100})+'\n');
  child.exitCode=0;child.emit('close',0);
  await assert.rejects(svc.image(ID2,{jobId:job.id}));
  const first=await svc.accept(ID,job.id);assert.equal(first.file,'001.png');assert.deepEqual(await svc.accept(ID,job.id),first);
  assert.equal((await svc.list(ID2)).length,0);assert.equal((await svc.list(ID))[0].prompt,'A quiet forest');
  assert.deepEqual(await svc.image(ID,{name:'001.png'}),png);await assert.rejects(svc.image(ID,{name:'../game.json'}));
  const second=await svc.generate(ID,{prompt:'A mountain'});await fs.writeFile(svc.jobs.get(ID).output,png);child.stdout.write('{"phase":"done"}\n');child.exitCode=0;child.emit('close',0);
  assert.equal((await svc.accept(ID,second.id)).file,'002.png');
  await svc.generate(ID,{prompt:'A lake'});await svc.cancel(ID);assert.equal(svc.jobs.get(ID).phase,'cancelled');assert.equal(svc.active,null);
 }finally{await svc.stop();await new Promise(r=>setTimeout(r,50));await fs.rm(root,{recursive:true,force:true});}
});
