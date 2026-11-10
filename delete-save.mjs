import {promises as fs} from 'node:fs';
import path from 'node:path';
export async function deleteSave(root,id,confirmation,locks){
 if(confirmation?.confirmed!==true||confirmation.confirmationId!==id)throw Error('A mentés törlését előbb meg kell erősítened.');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw Error('Érvénytelen mentésazonosító.');
 if(locks.has(id))throw Error('Ez a mentés éppen frissül. Várd meg a műveletet, majd próbáld újra.');
 locks.add(id);
 try{
  const saves=await fs.realpath(path.resolve(root)),target=path.resolve(saves,id);
  if(path.dirname(target)!==saves)throw Error('A törlési cél nincs a mentések könyvtárában.');
  const stat=await fs.lstat(target);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Csak valódi mentésmappa törölhető.');
  const actual=await fs.realpath(target);
  if(path.relative(saves,actual)!==id)throw Error('A mentés útvonala nem biztonságos.');
  await fs.access(path.join(actual,'game.json'));
  await fs.rm(actual,{recursive:true,force:false});
 }finally{locks.delete(id);}
}
