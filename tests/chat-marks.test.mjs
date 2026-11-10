import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDividerIndex} from '../public/chat-marks.js';

const messages=(...speakers)=>speakers.map((speaker,i)=>({id:'m'+i,speaker,text:'x'}));

test('Új üzenet jelölő: csak a nem saját, új üzenet előtt',()=>{
 assert.equal(newDividerIndex(messages('narrator','p'),0,'p'),-1,'első megnyitásnál nincs jelölő');
 assert.equal(newDividerIndex(messages('p','narrator'),2,'p'),-1,'nincs új üzenet');
 assert.equal(newDividerIndex(messages('p','narrator'),1,'p'),1,'a mesélő új üzenete jelölt');
 assert.equal(newDividerIndex(messages('p','p'),1,'p'),-1,'saját üzenet nem kap jelölőt');
 assert.equal(newDividerIndex(messages('narrator','p','n'),1,'p'),2,'az első nem saját új üzenet a jelölő helye');
});
