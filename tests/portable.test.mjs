import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ImageService} from '../image-service.mjs';

test('Portable Python preferred; YiffyMix alone is not a complete installation',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'earia-portable-'));
 try{
  const svc=new ImageService({root,saves:path.join(root,'saves')});
  const portable=path.join(root,'image-gen/runtime/python.exe');
  await fs.mkdir(path.dirname(portable),{recursive:true});await fs.writeFile(portable,'test fixture');
  assert.equal(await svc.python(),portable);
  const checkpoint=path.join(root,'image-gen/models/yiffymix/yiffymix.safetensors');
  await fs.mkdir(path.dirname(checkpoint),{recursive:true});await fs.writeFile(checkpoint,'fixture');
  assert.equal((await svc.availableModels()).some(m=>m.id==='yiffymix'),false);
  for(const f of ['model_index.json','tokenizer/vocab.json','text_encoder/model.fp16.safetensors']){
   const file=path.join(root,'image-gen/models/sd15',f);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'{}');
  }
  assert.equal((await svc.availableModels()).some(m=>m.id==='yiffymix'),true);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('Release template contains no API secret and defaults to remote API',async()=>{
 const config=JSON.parse(await fs.readFile(new URL('../config.example.json',import.meta.url),'utf8'));
 assert.equal(config.provider,'api');assert.equal(config.apiKeyEncrypted,'');assert.equal(config.modelPath,'');
});
