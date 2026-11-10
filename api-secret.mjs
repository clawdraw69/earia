import {spawn} from 'node:child_process';
function dpapi(value,decrypt){
 if(process.platform!=='win32')throw Error('A tartós API-kulcstárolás ebben a verzióban Windows alatt támogatott.');
 const script="$ErrorActionPreference='Stop';[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$v=[Console]::In.ReadToEnd();"+(decrypt?"$b=[Convert]::FromBase64String($v);$r=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($r))":"$b=[Text.Encoding]::UTF8.GetBytes($v);$r=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($r))");
 return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});let out='';
  const timer=setTimeout(()=>{child.kill();reject(Error('A kulcstárolás időtúllépés miatt sikertelen.'));},15000);
  child.stdout.setEncoding('utf8');child.stdout.on('data',s=>out+=s);child.stdin.on('error',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(Error('Nem indítható a Windows kulcstároló.'));});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(Error('Az API-kulcs nem olvasható/menthető ezzel a Windows-felhasználóval. Add meg újra.'));});child.stdin.end(value);
 });
}
export const protectKey=key=>dpapi(key,false);
export const revealKey=encrypted=>encrypted?dpapi(encrypted,true):Promise.resolve('');
