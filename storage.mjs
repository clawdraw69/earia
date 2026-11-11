import {t as tr} from "./i18n.mjs";
import {promises as fs} from 'node:fs';
import path from 'node:path';
export async function atomicJson(file,value){
 const temp=file+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify(value,null,2),'utf8');await fs.rename(temp,file);}
 catch(error){await fs.rm(temp,{force:true}).catch(()=>{});throw error;}
}
// game.json is the commit point; mirrors can always be rebuilt from it.
export async function persistGame(dir,g,{atomic=atomicJson,onMirrorError=console.error}={}){
 for(const c of g.characters)if(!/^[a-f0-9-]{36}$/.test(c.id))throw Error(tr('Érvénytelen karakterazonosító.'));
 await fs.mkdir(dir,{recursive:true});await fs.mkdir(path.join(dir,'images'),{recursive:true});
 g.updatedAt=new Date().toISOString();
 await atomic(path.join(dir,'game.json'),g);
 try{
  for(const c of g.characters){
   if(!/^[a-f0-9-]{36}$/.test(c.id))throw Error(tr('Érvénytelen karakterazonosító.'));
   const folder=path.join(dir,c.id===g.playerId?'player':path.join('npcs',c.id));
   await fs.mkdir(folder,{recursive:true});await atomic(path.join(folder,'character.json'),c);
  }
  await atomic(path.join(dir,'story-private.json'),g.privateStory??{});
 }catch(error){onMirrorError(tr('A fő mentés elkészült; a másolatok frissítése nem sikerült: ')+error.message);return [tr('A játék elmentve, de egy karakter- vagy tervmásolat nem frissült. A Mentés gombbal újrapróbálható.')];}
 return [];
}
