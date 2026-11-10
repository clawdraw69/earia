export async function stopChild(child,timeoutMs=10000){
 if(!child||child.exitCode!==null||child.signalCode)return;
 await new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);child.removeListener('exit',done);child.removeListener('error',fail);};
  const done=()=>{cleanup();resolve();};
  const fail=error=>{cleanup();reject(error);};
  const timer=setTimeout(()=>fail(Error('A motor nem állt le. Próbáld újra a kilépést.')),timeoutMs);
  child.once('exit',done);child.once('error',fail);
  try{child.kill();}catch(error){fail(error);}
 });
}
