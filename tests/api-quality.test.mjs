import {test} from 'node:test';
import assert from 'node:assert/strict';
import {API_DEFAULTS,remoteInfer} from '../api-provider.mjs';
import {nextSettings} from '../settings.mjs';
import {narratorSystem,narratorTurn} from '../narrator.mjs';
import {loadRules} from '../prompt.mjs';

const config={...API_DEFAULTS,apiKeyEncrypted:'cipher',modelPath:'x',runtimePath:'y',contextSize:8192,gpuLayers:0};
const schema={type:'object',properties:{messages:{type:'array',minItems:1,maxItems:1,items:{type:'object',properties:{speaker:{type:'string',enum:['narrator']},text:{type:'string'}},required:['speaker','text'],additionalProperties:false}}},required:['messages'],additionalProperties:false};
const reply=(content,finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content}}]}));

test('Szabályfájl: szakaszok, felnőtt hangnem be/ki, gépies szerződés',async()=>{
 const rules=loadRules(new URL('../prompts/narrator.md',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 assert.equal(rules.missing,undefined);
 const on=narratorSystem({name:'Earia'},rules.text,{adultTone:true});
 const off=narratorSystem({name:'Earia'},rules.text,{adultTone:false});
 assert.match(on,/FELNŐTT HANGNEM/);
 assert.doesNotMatch(off,/FELNŐTT HANGNEM/);
 assert.doesNotMatch(off,/testi közelség a történet természetes része/);
 for(const text of [on,off])assert.match(text,/200–350 szót/);
 assert.match(on,/JELENETVEZETÉS/);
 assert.match(on,/ne írd le újra/);
 assert.match(on,/VILÁGADATOK/);
 assert.match(on,/ADATÁTADÁS/);
 assert.match(on,/speaker értéke soha nem a játékos azonosítója/);
 const game={playerId:'p',characters:[{id:'p',name:'Tob',age:21,clan:'Wulf',sex:'male',stats:[5,5,5,5,5,5,5],state:{vf:1,vn:1}}],minutes:0,location:'',summary:'',memories:[],privateStory:{},setup:{},scene:{active:false,round:0,members:[]},messages:[]};
 assert.match(narratorTurn(game,'Körülnézek.').prompt,/HOSSZ ÉS FELÉPÍTÉS/);
 assert.match(narratorTurn(game,'Mi történt?',true).prompt,/Válaszolj röviden/);
});
test('Beállítások: hőfok korlátok és felnőtt hangnem normalizálása',async()=>{
 assert.equal((await nextSettings(config,{narrationTemperature:5})).narrationTemperature,1);
 assert.equal((await nextSettings(config,{narrationTemperature:0.1})).narrationTemperature,0.6);
 assert.equal((await nextSettings(config,{narrationTemperature:'abc'})).narrationTemperature,0.85);
 assert.equal((await nextSettings(config,{narrationTemperature:'1.3'})).narrationTemperature,1);
 assert.equal((await nextSettings(config,{adultTone:'on'})).adultTone,true);
 assert.equal((await nextSettings(config,{adultTone:false})).adultTone,false);
 assert.equal((await nextSettings(config,{})).adultTone,true);
});

test('API-kérés: nagyobb válaszkeret, beállított hőfok, szűrt és elutasított válasz',async()=>{
 let sent;
 const capture=async(url,init)=>{sent=JSON.parse(init.body);return reply(JSON.stringify({messages:[{speaker:'narrator',text:'A tűz pattog, a füst a gerendák felé száll.'}]}));};
 await remoteInfer({...config,narrationTemperature:1.2},'kulcs','Rendszer','Felhasználó',schema,{fetcher:capture});
 assert.equal(sent.max_tokens,8192);
 assert.equal(sent.temperature,1.2);
 assert.equal(sent.response_format.type,'json_object');
 assert.equal(sent.chat_template_kwargs,undefined);
 assert.match(sent.messages[1].content,/A kötelező JSON-séma: /);
 const fetchWith=content=>async()=>reply(content);
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:fetchWith('Sajnálom, ezt nem tudom megírni.')}),/elutasította/);
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:async()=>reply('','content_filter')}),/tartalmi szűrő/);
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:fetchWith('')}),/üres választ/);
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:async()=>reply('','length')}),/hosszkorlátot/);
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:fetchWith(JSON.stringify({messages:[{speaker:'narrator',text:'Sajnálom, nem tudok ilyen tartalmat írni.'}]}))}),/elutasító/);
 await remoteInfer(config,'kulcs','R','F',schema,{fetcher:fetchWith(JSON.stringify({messages:[{speaker:'narrator',text:'Nem tudok aludni, a tűz mellett virrasztok.'}]}))});
});

test('Sémahiba esetén egy javító újrapróbálkozás történik',async()=>{
 let calls=0;
 const fetcher=async()=>{
  calls++;
  return calls===1
   ? reply(JSON.stringify({messages:[{speaker:'narrator',text:'Rövid.',extra:'nem engedett mező'}]}))
   : reply(JSON.stringify({messages:[{speaker:'narrator',text:'A tűz ellobbant, a zsarátnok vörösen izzik.'}]}));
 };
 const data=await remoteInfer(config,'kulcs','R','F',schema,{fetcher});
 assert.equal(calls,2);
 assert.equal(data.messages[0].text,'A tűz ellobbant, a zsarátnok vörösen izzik.');
});

test('Hibás JSON: egy javítás, majd tiszta magyar hibaüzenet',async()=>{
 let calls=0;
 const broken=async()=>{calls++;return reply('{"messages":[{"speaker":"narrator","text":"Azt mondja: "nem jövök"."}]}');};
 await assert.rejects(remoteInfer(config,'kulcs','R','F',schema,{fetcher:broken}),/nem adott feldolgozható JSON/);
 assert.equal(calls,2);
 calls=0;
 const truncatedThenGood=async()=>{calls++;return calls===1?reply('{"messages":[{"speaker":"narrator","text":"Hiányos'):reply(JSON.stringify({messages:[{speaker:'narrator',text:'A lámpás kialudt.'}]}));};
 const data=await remoteInfer(config,'kulcs','R','F',schema,{fetcher:truncatedThenGood});
 assert.equal(calls,2);
 assert.equal(data.messages[0].text,'A lámpás kialudt.');
});

test('Sémahiba megnevezi a hibás mezőt a hibaüzenetben',async()=>{
 const tiny={type:'object',properties:{messages:{type:'array',minItems:1,maxItems:1,items:{type:'object',properties:{speaker:{type:'string',enum:['narrator']},text:{type:'string',maxLength:5}},required:['speaker','text'],additionalProperties:false}}},required:['messages'],additionalProperties:false};
 const fetcher=async()=>reply(JSON.stringify({messages:[{speaker:'narrator',text:'Ez a szöveg hosszabb a megengedettnél.'}]}));
 await assert.rejects(remoteInfer(config,'kulcs','R','F',tiny,{fetcher}),/\$\.messages\[0\]\.text/);
});

test('Szétesett válasz újraindított JSON-ja helyreáll',async()=>{
 const garbage='{"messages":[{"speaker":"narrator","text":"A piac zaja elhal';
 const restarted=JSON.stringify({messages:[{speaker:'narrator',text:'A piac zaja elhalt, a kapu előtt álltok.'}]});
 const fetcher=async()=>reply(garbage+'<｜end▁of▁thinking｜>'+restarted);
 const data=await remoteInfer(config,'kulcs','R','F',schema,{fetcher});
 assert.equal(data.messages[0].text,'A piac zaja elhalt, a kapu előtt álltok.');
});
test('Játékos-beszélő kiesik, a jelenet megmarad',async()=>{
 const fetcher=async()=>reply(JSON.stringify({messages:[{speaker:'narrator',text:'A kapu nyitva áll.'},{speaker:'player',text:'Bemegyek.'}]}));
 const data=await remoteInfer(config,'kulcs','R','F',schema,{fetcher});
 assert.equal(data.messages.length,1);
 assert.equal(data.messages[0].text,'A kapu nyitva áll.');
});
