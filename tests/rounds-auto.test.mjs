import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRoundEvents} from '../auto-rounds.mjs';
import {roundStrip,roundPanel} from '../public/scene-view.js';

const esc=v=>String(v??'');
const makeGame=()=>({
 characters:[
  {id:'p',name:'Baal',sex:'male',stats:[5,5,5,5,5,6,5],state:{vf:1,vn:1},primaryZones:['anal','penis']},
  {id:'n',name:'Grom',sex:'male',stats:[5,5,5,5,5,4,5],state:{vf:1,vn:1},primaryZones:['anal','penis']}
 ],
 scene:{active:false,round:0,members:[]}
});

test('Aktus-jelzés automatikusan indítja a körszámlálást',()=>{
 const g=makeGame();
 const first=applyRoundEvents(g,[{characterId:'p',contacts:{anal:1},directions:['male']}]);
 assert.equal(first.started,true);
 assert.equal(g.scene.active,true);
 assert.equal(g.scene.round,1);
 const p=()=>g.scene.members.find(m=>m.id==='p');
 assert.equal(p().stamina,5);
 // két bemelegítő kör: nincs levonás
 applyRoundEvents(g,[{characterId:'p',contacts:{anal:1},directions:['male']}]);
 assert.equal(g.scene.round,2);
 assert.equal(p().stamina,5);
 // harmadik körtől levonás
 applyRoundEvents(g,[{characterId:'p',contacts:{anal:1},directions:['male']}]);
 assert.equal(g.scene.round,3);
 assert.equal(p().stamina,4);
});

test('Esemény nélkül nem indul kör, és a meglévő kör áll',()=>{
 const g=makeGame();
 const none=applyRoundEvents(g,[]);
 assert.equal(none.active,false);
 assert.equal(g.scene.active,false);
 applyRoundEvents(g,[{characterId:'p',contacts:{oral:1}}]);
 const idle=applyRoundEvents(g,[{characterId:'p',contacts:{}}]);
 assert.equal(idle.started,false);
 assert.equal(g.scene.round,1);
});

test('A bal oldali körcsík és a részletes panel a stamina adatokat mutatja',()=>{
 const g=makeGame();
 applyRoundEvents(g,[{characterId:'p',contacts:{anal:1},directions:['male']}]);
 const strip=roundStrip(g,esc);
 assert.match(strip,/1\. kör/);
 assert.match(strip,/Baal · S 5/);
 assert.match(strip,/Grom · S 3/);
 const panel=roundPanel(g,esc);
 assert.match(panel,/Körszámlálás/);
 assert.match(panel,/anal 1 · férfi/);
 assert.match(panel,/Vf 1\.00 · Vn 1\.00/);
 assert.match(panel,/end-rounds-here/);
 const idle=roundPanel(makeGame(),esc);
 assert.match(idle,/Automatikus/);
});
