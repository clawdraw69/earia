import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {listModels,modelInfo} from '../models.mjs';

test('A modelllista a saját mappát és almappáit járja be, a hiányos letöltést és segédfájlokat kihagyja',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'earia-models-'));
 try{
  await fs.mkdir(path.join(dir,'models','almappa'),{recursive:true});
  const files={'models/Árvíz.gguf':'GGUFmodel','models/almappa/Modell (1).GGUF':'GGUFother','models/hibás.gguf':'oops','models/mmproj-F16.gguf':'GGUFprojector','models/mtp-model.gguf':'GGUFhead','models/readme.txt':'hello','külső.gguf':'GGUFexternal','models/shard-00001-of-00002.gguf':'GGUFfirst','models/shard-00002-of-00002.gguf':'GGUFsecond'};
  for(const [name,data] of Object.entries(files))await fs.writeFile(path.join(dir,name),data);
  const result=await listModels(path.join(dir,'models'));
  assert.equal(result.length,3);assert.ok(result.some(m=>m.name==='Árvíz.gguf'));assert.ok(result.some(m=>m.name.includes('Modell (1).GGUF')));assert.ok(result.every(m=>m.path.startsWith(path.join(dir,'models'))));assert.ok(result.some(m=>m.name==='shard-00001-of-00002.gguf'));
  const external=await modelInfo(path.join(dir,'külső.gguf'));assert.equal(external.name,'külső.gguf');await assert.rejects(()=>modelInfo(path.join(dir,'models','hibás.gguf')),/GGUF/);assert.deepEqual(await listModels(path.join(dir,'nincs')),[]);await fs.unlink(path.join(dir,'models/shard-00002-of-00002.gguf'));assert.equal((await listModels(path.join(dir,'models'))).length,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
