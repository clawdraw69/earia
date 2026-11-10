import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isUppercaseOoc,shouldSend} from '../public/chat-input.js';
test('Nagybetűs magyar szöveg OOC; szám és normál mondat nem',()=>{
 for(const s of ['GROM SZEME LEGYEN ARANYSZÍNŰ!','Ő MÉG NEM ISMERI TOBOT.','ÁRNYÉK\nÉS FÉNY'])assert.equal(isUppercaseOoc(s),true);
 for(const s of ['Tob vagyok.','123!','...','','GROM szeme kék'])assert.equal(isUppercaseOoc(s),false);
});
test('Enter küld, Shift+Enter és IME nem küld; ismétlés nem dupláz',()=>{
 assert.equal(shouldSend({key:'Enter'}),true);
 for(const extra of [{shiftKey:true},{isComposing:true},{repeat:true}])assert.equal(shouldSend({key:'Enter',...extra}),false);
});
