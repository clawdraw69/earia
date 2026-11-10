import {test} from 'node:test';
import assert from 'node:assert/strict';
import {narratorCharacter,narratorCharacters,narratorSystem,narratorTurn,isAppearanceRequest,characterAppearance} from '../narrator.mjs';
const c={id:'b',name:'Baal',age:21,clan:'Ursa',sex:'male',stats:[7,7,7,6,7,6,3],orientation:3,blessings:[],description:'',state:{vf:2,vn:1.4}};
test('A narrátor a magas teltséget testalkatként, nem izomzatként kapja meg',()=>{const n=narratorCharacter(c,'b');assert.equal(n.appearance.build,'a klánjában hangsúlyos, nagy');assert.equal(n.attributes.Teltség.value,7);assert.match(n.appearance.form,/antropomorf medve/);assert.equal(n.appearance.authorDescription,'Nincs külön megadva.');});
test('Az anatómiai stat neve nem keverhető össze egy állati farokkal',()=>{const n=narratorCharacter(c,'b');assert.equal('Farokméret' in n.attributes,false);assert.equal(n.attributes['Nemi szerv mérete (nem az állati farok hossza)'].value,7);});
test('A női karakter emberi marad, a szerzői egyedi leírás megőrződik',()=>{const n=narratorCharacter({...c,sex:'female',clan:'Boszorkány',description:'Rövid fekete haj, barna szem.'},'más');assert.equal(n.appearance.form,'emberi nő, állati jegyek nélkül');assert.equal(n.appearance.authorDescription,'Rövid fekete haj, barna szem.');assert.equal(n.role,'fő NPC');assert.equal(n.attributes.Mellméret.value,7);});
test('A kontextus a szerepeket azonosító alapján különíti el, nem névből találgat',()=>{const g={playerId:'b',characters:[c,{...c,id:'g',name:'Grom'}]};const context=narratorCharacters(g);assert.match(context[0].role,/játékoskarakter/);assert.equal(context[1].role,'fő NPC');assert.match(narratorSystem({calendar:'rögzített'},'Magyar stílus'),/Magyar stílus/);});
test('A leírás-kérés a modellhez megy, a karakterlap nem épül be',()=>{
 const game={playerId:'b',characters:[{...c,name:'Baal · próbajáték'}, {...c,id:'g',name:'Grom',age:50,description:'A szerző szerint rövid hege van.'}],minutes:0,location:'HISTORY_POISON hely',summary:'HISTORY_POISON összefoglaló',memories:['HISTORY_POISON emlék'],privateStory:{plan:'HISTORY_POISON terv'},scene:{pose:'HISTORY_POISON ölelés'},messages:[{speaker:'narrator',text:'HISTORY_POISON tenyeresek és hosszú állati farok'}]};
 const before=JSON.stringify(game),turn=narratorTurn(game,'írd le hogy néz ki grom és baal',true);
 assert.equal(turn.appearanceOnly,false);assert.equal(turn.appearanceRequest,undefined);
 assert.match(turn.prompt,/írd le hogy néz ki grom és baal/);assert.match(turn.prompt,/A szerző szerint rövid hege van/);
 assert.equal(JSON.stringify(game),before);
});
test('A karakterlap-lekérdezés ki van kapcsolva, minden leírást a modell ad',()=>{
 const chars=[c,{...c,name:'Grom'}];for(const text of ['Hogy néz ki Grom és Baal?','Hogyan néznek ki Baal és Grom?','Írd le Grom külsejét.','végigmérem Mattet. mit látok?'])assert.equal(isAppearanceRequest(text,chars),false,text);
});
test('A rendes történetfolytatás megőrzi az időt, a memóriát és a beszélgetést',()=>{
 const game={playerId:'b',characters:[c],minutes:15,location:'Jégkarom',summary:'Hó esik.',memories:['A csengő a játékosnál van.'],privateStory:{plan:'titok'},scene:{active:false},messages:[{speaker:'b',text:'Itt várok.'}]};
 const turn=narratorTurn(game,'Megkérdezem Gromot az ösvényről.');assert.equal(turn.appearanceOnly,false);assert.match(turn.prompt,/Itt várok/);assert.match(turn.prompt,/A csengő a játékosnál van/);assert.match(turn.prompt,/"calendar":\{/);
});
test('A részletesebben sem nyit külön karakterlapot',()=>{
 const game={playerId:'b',characters:[c,{...c,id:'g',name:'Grom'}],minutes:0,memories:[],location:'',summary:'',messages:[{speaker:'ooc',text:'írd le hogy néz ki grom és baal'},{speaker:'narrator',text:'régi leírás'},{speaker:'ooc',text:'részletesebben.'},{speaker:'narrator',text:'téves folytatás'}]};
 for(const query of ['részletesebben.','még bővebben','pontosabban kérlek']){const turn=narratorTurn(game,query,true);assert.equal(turn.appearanceOnly,false);assert.equal(turn.appearanceRequest,undefined);assert.ok(turn.prompt.includes(query),query);}
});
test('A részletes karakterlap a tényleges kort és testalkatot mutatja, nem talál ki hiányzó jegyeket',()=>{
 const game={playerId:'b',characters:[c,{...c,id:'g',name:'Grom',age:50}]};const text=characterAppearance(game,'hogy néz ki Grom és Baal',true);assert.match(text,/Baal: 21 éves antropomorf medveférfi/);assert.match(text,/Grom: 50 éves antropomorf medveférfi/);assert.match(text,/masszív és kövér/);assert.match(text,/bundaszíne és állati farkának hossza nincs rögzítve/);assert.doesNotMatch(text,/sötétbarna|világosbarna|karjában|tenyeresei/);
});
test('Az elmentett leírásmód követhető, de egy új játékosi cselekvés lezárja',()=>{
 const game={playerId:'b',characters:[c],minutes:0,memories:[],messages:[{speaker:'ooc',text:'bővebben',contextKind:'appearance',appearanceRequest:'Hogy néz ki Baal?'},{speaker:'narrator',text:'POISON'}]};
 assert.equal(narratorTurn(game,'külön-külön',true).appearanceOnly,true);
 game.messages.push({speaker:'b',text:'Elindulok a völgybe.'});assert.equal(narratorTurn(game,'részletesebben',true).appearanceOnly,false);
});
test('Az önálló részletesebben nem indít karakterleírást előzmény nélkül',()=>{
 const game={playerId:'b',characters:[c],minutes:0,memories:[],messages:[]};assert.equal(narratorTurn(game,'részletesebben.',true).appearanceOnly,false);
});

test('A vágy 6 felett aktív keresést jelez a karakteradatban',()=>{
 const npc={...c,id:'g',name:'Grom',state:{vf:6,vn:2}};
 const data=narratorCharacter(npc,'x');
 assert.equal(data.state.activeSeeking,true);
 assert.equal(data.state.seekingDirection,'férfiak felé');
 assert.equal(data.state.vfDescription,'izzó vágy');
 const calm=narratorCharacter({...c,id:'h',state:{vf:2,vn:3}},'x');
 assert.equal(calm.state.activeSeeking,false);
 assert.equal(calm.state.seekingDirection,'nők felé');
});
test('A testi izgalom címkéje a vágy értékét követi',()=>{
 const low={...c,id:'l',state:{vf:1.3,vn:1}};
 const mid={...c,id:'m',state:{vf:3,vn:1}};
 const high={...c,id:'h',state:{vf:5,vn:2}};
 assert.equal(narratorCharacter(low,'x').state.arousal,'száraz, nyugodt');
 assert.equal(narratorCharacter(mid,'x').state.arousal,'enyhén nedves');
 assert.equal(narratorCharacter(high,'x').state.arousal,'csöpögő');
});
