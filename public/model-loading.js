import {t as tr} from "./i18n.js";
export function loadingView(status,now=Date.now()){
 const s=status.loading||{},elapsed=s.startedAt?Math.max(0,Math.floor((now-s.startedAt)/1000)):0;
 const age=s.lastActivityAt?Math.max(0,Math.floor((now-s.lastActivityAt)/1000)):null;
 return {phase:s.phase||'starting',percent:typeof s.percent==='number'?s.percent:null,message:status.status||tr('Motor indítása…'),time:`${tr("Eltelt idő: ")}${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`,activity:age===null?tr('Várakozás a motor első jelzésére…'):`${tr("Utolsó motorjelzés: ")}${age}${tr(" másodperce")}`};
}
export async function showModelLoading({api,notify}){
 document.getElementById('modal')?.close();
 const panel=document.createElement('section');panel.className='busy-overlay model-loading';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',tr('Modell betöltése'));
 panel.innerHTML=tr('<div class="model-loading-card"><h2>Modell betöltése</h2><p class="load-message" role="status" aria-live="polite"></p><progress class="load-progress" max="100" aria-label="Modell betöltése"></progress><div class="load-percent"></div><p class="load-time"></p><small class="load-activity"></small><p class="muted">A 100% a modellsúlyok betöltését jelzi. Utána még végső előkészítés következhet.</p><div class="actions"><button class="load-stop">Leállítás</button><button class="load-close" hidden>Rendben</button></div></div>');
 document.body.append(panel);const find=s=>panel.querySelector(s);let done=false,failures=0;
 const close=()=>{done=true;panel.remove();};
 find('.load-close').onclick=close;
 function terminal(message,success=false,stopped=false){done=true;find('.load-message').textContent=message;find('.load-stop').hidden=success||stopped;find('.load-close').hidden=false;find('.load-close').textContent=success?tr('Rendben'):tr('Bezárás');find('.load-close').focus();if(success){find('progress').value=100;find('.load-percent').textContent=tr('100% · Használatra kész');panel.classList.add('loaded');notify(tr('A modell betöltődött, használatra kész.'));}else{find('.load-percent').textContent=tr('A betöltés nem fejeződött be.');panel.classList.add('load-error');}}
 find('.load-stop').onclick=async()=>{find('.load-stop').disabled=true;try{await api('/ai/stop',{});terminal(tr('A betöltést leállítottad.'),false,true);}catch(e){find('.load-message').textContent=e.message;find('.load-stop').disabled=false;}};
 function render(s){const v=loadingView(s);find('.load-message').textContent=v.message;find('.load-time').textContent=v.time;find('.load-activity').textContent=v.activity;
  if(v.percent===null){find('progress').removeAttribute('value');find('.load-percent').textContent=tr('Előkészítés · várakozás a betöltési adatra');}else{find('progress').value=v.percent;find('.load-percent').textContent=v.percent+'%'+(v.phase==='initializing'?tr(' · Végső előkészítés'):'');}
  if(s.ready)terminal(v.message,true);else if(v.phase==='error')terminal(v.message);else if(v.phase==='idle')terminal(v.message,false,true);
 }
 find('.load-message').textContent=tr('Motor indítása…');find('.load-percent').textContent=tr('Előkészítés…');find('.load-stop').focus();
 try{const initial=await api('/ai/start',{});if(!done)render(initial);}catch(e){terminal(e.message);return;}
 while(!done){await new Promise(r=>setTimeout(r,700));if(done)break;try{const s=await api('/status');failures=0;if(!done)render(s);}catch{failures++;find('.load-message').textContent=tr('A kapcsolat ellenőrzése…');if(failures>=5)terminal(tr('Megszakadt a kapcsolat a játékprogrammal. Ellenőrizd, hogy fut-e.'));}}
}
