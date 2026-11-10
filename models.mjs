import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Support GGUFs (vision projectors, imatrix data, MTP heads) are not chat models.
export function isModelFilename(name){
 const shard=name.match(/-(\d{5})-of-\d{5}\.gguf$/i);
 return /\.gguf$/i.test(name)&&!/^(mmproj|imatrix|mtp)[-_.]/i.test(name)&&(!shard||shard[1]==='00001');
}
export async function modelInfo(file,root=path.dirname(file)){
 if(!isModelFilename(path.basename(file)))throw Error('Szöveges GGUF modellfájlt válassz.');
 const shard=file.match(/-00001-of-(\d{5})\.gguf$/i);
 if(shard){
  const count=Number(shard[1]);if(count<1||count>1024)throw Error('Érvénytelen GGUF darabszám.');
  for(let i=2;i<=count;i++){
   const part=file.replace(/-00001-of-/i,'-'+String(i).padStart(5,'0')+'-of-');
   const h=await fs.open(part,'r');try{const magic=Buffer.alloc(4);await h.read(magic,0,4,0);if(magic.toString('ascii')!=='GGUF')throw Error('Hiányos vagy hibás GGUF darab.');}finally{await h.close();}
  }
 }
 const stat=await fs.stat(file);
 if(!stat.isFile())throw Error('A kiválasztott útvonal nem fájl.');
 const handle=await fs.open(file,'r');
 try{const magic=Buffer.alloc(4);await handle.read(magic,0,4,0);if(magic.toString('ascii')!=='GGUF')throw Error('A fájl nem érvényes GGUF modell.');}
 finally{await handle.close();}
 return {path:path.resolve(file),name:path.relative(root,file),sizeBytes:stat.size};
}
export async function listModels(directory){
 const result=[];
 async function walk(dir){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
 for(const entry of entries){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile()&&isModelFilename(entry.name)){try{result.push(await modelInfo(file,directory));}catch{ /* Partial or invalid downloads are not selectable models. */ }}}
 }
 await walk(directory);return result.sort((a,b)=>a.name.localeCompare(b.name,'hu',{numeric:true}));
}
export async function browseModel(directory,script){
 if(process.platform!=='win32')throw Error('A natív tallózás ebben a verzióban Windows alatt érhető el.');
 const file=await new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,env:{...process.env,EARIA_MODEL_DIRECTORY:directory},stdio:['ignore','pipe','pipe']});
  let output='',error='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>error+=s);child.on('error',reject);child.on('exit',code=>{if(code!==0)return reject(Error('A fájlválasztó nem indult el. '+error.slice(0,200)));try{const result=JSON.parse(output.replace(/^\uFEFF/,'').trim());resolve(result.path||null);}catch{reject(Error('A fájlválasztó hibás választ adott.'));}});
 });
 return file?modelInfo(file):null;
}
