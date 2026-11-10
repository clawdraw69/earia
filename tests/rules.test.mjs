import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ranges,cost,validateCharacter,calendar,startScene,stepScene,advanceTime,seedDesire,desiredState,applyDesireEvents} from '../rules.mjs';
function character(){return {...validateCharacter({name:'Baal',age:21,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3],blessings:[],orientation:3}),id:'player',state:{vf:2,vn:1.4}};}
test('Boszorkány: nő, hét darab 3–7 sáv, az 5 ingyenes',()=>{assert.deepEqual(ranges('Boszorkány','female'),Array.from({length:7},()=>[3,7]));assert.throws(()=>ranges('Boszorkány','male'));assert.equal(cost(5,[3,7]),0);assert.equal(cost(8,[3,7]),2);assert.equal(cost(10,[3,7]),10);});
test('Pontozás mindkét irányban, keret és életkor validálás',()=>{assert.equal(cost(7,[8,10]),2);assert.equal(cost(6,[8,10]),4);assert.equal(cost(5,[8,10]),10);assert.equal(cost(4,[8,10]),Infinity);assert.equal(character().unspent,10);assert.throws(()=>validateCharacter({...character(),age:17}));assert.throws(()=>validateCharacter({...character(),stats:[10,10,10,10,10,10,10]}));});
test('Végleges holdnaptár és hónap/év váltás',()=>{const start=calendar(0);assert.equal(start.gold,14);assert.equal(start.blue,14);assert.equal(start.feral,false);assert.equal(start.doubleFull,true);for(const day of [8,15,22]){const c=calendar((day-1)*1440);assert.ok(Math.abs(c.blue-14)<.00001);assert.equal(c.feral,true);}assert.equal(calendar(14*1440).gold,-14);assert.equal(calendar(28*1440).day,1);assert.equal(calendar(28*1440).month,2);assert.equal(calendar(336*1440).year,2);});
test('Két bemelegítő kör, összeadódó terhelés és következő körös küszöb',()=>{const c=character();const g={characters:[c],scene:{active:false}};startScene(g);const contacts=[{id:c.id,contacts:{anal:1},directions:['male']}];const m=()=>g.scene.members[0];assert.equal(m().stamina,5);stepScene(g,contacts);stepScene(g,contacts);assert.equal(m().stamina,5);for(let i=0;i<4;i++)stepScene(g,contacts);assert.equal(m().stamina,1);assert.equal(m().due,true);stepScene(g,contacts);assert.equal(c.state.vf,1);assert.equal(c.state.vn,1);assert.equal(m().completed,true);});
test('Fél terhelés és üres köradat visszautasítása',()=>{const c=character(),g={characters:[c],scene:{active:false}};startScene(g);assert.throws(()=>stepScene(g,[]));assert.equal(g.scene.round,0);for(let i=0;i<3;i++)stepScene(g,[{id:c.id,contacts:{oral:1},directions:[]}]);assert.equal(g.scene.members[0].stamina,4.5);});
test('Időbecslés alapján napváltás, napi változás csak jeleneten kívül',()=>{const c=character(),g={characters:[c],minutes:0,scene:{active:false}};advanceTime(g,1440);assert.equal(c.state.vf,2.1);assert.equal(c.state.vn,1.6);g.scene.active=true;advanceTime(g,1440);assert.equal(c.state.vf,2.1);assert.throws(()=>advanceTime(g,-1));});
test('Kezdő vágy: heterónál és homónál egy tengely számít, bi-nál kettő',()=>{
 const p=(sex,o,d)=>seedDesire({sex,orientation:o},d);
 assert.deepEqual(p('female',1,{vf:4,vn:3}),{vf:4,vn:1});
 assert.deepEqual(p('male',1,{vf:1,vn:5}),{vf:1,vn:5});
 assert.deepEqual(p('male',7,{vf:6,vn:1}),{vf:6,vn:1});
 assert.deepEqual(p('female',7,{vf:1,vn:2}),{vf:1,vn:2});
 assert.deepEqual(p('female',4,{vf:2,vn:5}),{vf:2,vn:5});
 assert.deepEqual(desiredState({sex:'female',orientation:1},4),{vf:4,vn:1});
});
test('Vágy-események: irány, első/további kapás, napi egyszer, plafon',()=>{
 const a={id:'a',name:'A',sex:'male',orientation:4,state:{vf:1,vn:1}},b={id:'b',name:'B',sex:'female',state:{vf:1,vn:1}};
 const game=()=>({characters:[a,b],minutes:0,scene:{active:false}});
 const g=game();
 applyDesireEvents(g,[{characterId:'a',kind:'erogenous_receive',partnerId:'b'},{characterId:'a',kind:'erogenous_receive',partnerId:'b'}]);
 assert.deepEqual(a.state,{vf:1,vn:1.4});
});
test('Vágy-események: +0,5/kör plafon és napi egyszeri tételek',()=>{
 const a={id:'a',name:'A',sex:'male',orientation:4,state:{vf:1,vn:1}};
 const g={characters:[a],minutes:0,scene:{active:false}};
 applyDesireEvents(g,[{characterId:'a',kind:'intense_touch'},{characterId:'a',kind:'erogenous_give'},{characterId:'a',kind:'nudity'},{characterId:'a',kind:'scent'}]);
 assert.deepEqual(a.state,{vf:1.5,vn:1});
 a.state={vf:1,vn:1};
 applyDesireEvents(g,[{characterId:'a',kind:'sleep_together'},{characterId:'a',kind:'sleep_together'}]);
 assert.deepEqual(a.state,{vf:1.2,vn:1});
 g.minutes=1440;
 applyDesireEvents(g,[{characterId:'a',kind:'sleep_together'}]);
 assert.deepEqual(a.state,{vf:1.4,vn:1});
});
test('Vágy-események: aktus közben nincs változás',()=>{
 const a={id:'a',name:'A',sex:'male',orientation:4,state:{vf:1,vn:1}};
 const g={characters:[a],minutes:0,scene:{active:true}};
 assert.deepEqual(applyDesireEvents(g,[{characterId:'a',kind:'intense_touch'}]),[]);
 assert.deepEqual(a.state,{vf:1,vn:1});
});
