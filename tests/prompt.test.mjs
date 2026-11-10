import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadRules,dropSection,buildSystem} from '../prompt.mjs';

test('Szabályfájl: betöltés, megjegyzés kiszűrése, verzióhash',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'earia-rules-'));
 const file=path.join(tmp,'n.md');
 await fs.writeFile(file,'<!-- rejtett -->\n## A\nszöveg','utf8');
 const first=loadRules(file);
 assert.equal(first.text,'## A\nszöveg');
 assert.match(first.hash,/^[a-f0-9]{12}$/);
 await new Promise(r=>setTimeout(r,25));
 await fs.writeFile(file,'<!-- rejtett -->\n## A\nmás szöveg','utf8');
 const second=loadRules(file);
 assert.notEqual(first.hash,second.hash);
 const missing=loadRules(path.join(tmp,'nincs.md'));
 assert.equal(missing.missing,true);
 assert.ok(missing.text.length>20);
 await fs.rm(tmp,{recursive:true,force:true});
});

test('Felnőtt szakasz kihagyása és a gépies szerződés érintetlensége',()=>{
 const text='## HANGNEM\nmagyar\n\n## Felnőtt hangnem\ntestbelseje\n\n## HOSSZ\n120–200 szó';
 const off=dropSection(text,'Felnőtt hangnem');
 assert.doesNotMatch(off,/testbelseje/);
 assert.match(off,/HANGNEM/);
 assert.match(off,/HOSSZ/);
 const sys=buildSystem({name:'Earia'},text,{adultTone:false});
 assert.match(sys,/VILÁGADATOK/);
 assert.match(sys,/ADATÁTADÁS/);
 assert.doesNotMatch(sys,/testbelseje/);
});
