import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samplingForModel} from '../model-profile.mjs';
test('Qwen3.6 helyben tesztelt magyar profil, más modellek profilja megmarad',()=>{
 assert.deepEqual(samplingForModel('Qwen3.6-27B-Q4_K_M.gguf'),{temperature:.4,top_p:.9,top_k:20,min_p:0,presence_penalty:0,repeat_penalty:1});
 assert.equal(samplingForModel('gemma-4-model.gguf').top_k,64);
 assert.equal(samplingForModel('other.gguf').temperature,.6);
});
