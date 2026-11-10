import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directOocPlan,applyOocPlan} from '../ooc.mjs';
import {narratorTurn,characterAppearance,isAppearanceRequest} from '../narrator.mjs';
const game=()=>({playerId:'b',characters:[{id:'g',name:'Grom',age:50,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3],description:''},{id:'b',name:'Baal',age:21,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3]}],messages:[{speaker:'narrator',text:'Grom szeme kék. Grom ismeri Baalt.'}],summary:'Grom szeme kék. A barlang hideg.',memories:['Grom jól ismeri Baalt.','Van egy kehely.'],privateStory:{plan:'Grom szeme kék. Grom ismeri Baalt. A kehely elrejtve.'},minutes:0,scene:{},choices:['régi'],pendingEvents:[]});
test('OOC szemszín: tartós adat, kontextusjavítás, régi próza kizárása',()=>{
 const old=game(),result=applyOocPlan(old,'Grom szeme legyen aranyszínű',directOocPlan(old,'Grom szeme legyen aranyszínű')),g=result.game;
 assert.equal(g.characters[0].appearanceFacts.eyeColor,'aranyszínű');assert.equal(old.characters[0].appearanceFacts,undefined);
 assert.equal(g.summary,'A barlang hideg.');assert.ok(!JSON.stringify(g.privateStory).includes('kék'));
 assert.match(characterAppearance(g,'hogy néz ki a két ursa?',true),/Szemszín: aranyszínű/);
 assert.equal(isAppearanceRequest('hogy néz ki a két ursa?',g.characters),false);
 const prompt=narratorTurn(g,'Belépek a barlangba.').prompt;assert.ok(!prompt.includes('Grom szeme kék'));assert.match(prompt,/aranyszínű/);
 assert.equal(directOocPlan(old,'Milyen színű Grom szeme, arany?'),null);
});
test('OOC ismeretségi hiba javítja a mentett emléket és rejtett tervet',()=>{
 const old=game(),text='Grom még nem ismeri Baalt.',g=applyOocPlan(old,text,directOocPlan(old,text)).game;
 assert.equal(g.characters[0].knowledgeFacts[0].known,false);assert.deepEqual(g.memories,['Van egy kehely.']);assert.ok(!JSON.stringify(g.privateStory).includes('ismeri Baalt'));assert.ok(g.adminState.canon.some(f=>f.text===text));
});
test('Érvénytelen javítás nem módosítja az eredeti mentést',()=>{
 const old=game(),before=JSON.stringify(old),plan=directOocPlan(old,'Grom szeme legyen arany');plan.characterEdits.push({id:'nincs',field:'age',value:'50'});
 assert.throws(()=>applyOocPlan(old,'Grom szeme legyen arany',plan));assert.equal(JSON.stringify(old),before);
});
