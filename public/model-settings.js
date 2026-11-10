import {showModelLoading} from './model-loading.js';
let statusPoll;

export async function openModelSettings({api,dialog,notify}){
 const [status,listing]=await Promise.all([api('/status'),api('/models')]);
 clearInterval(statusPoll);
 dialog('Mesélő beállítása',`<div class="status-line" id="ai-status"></div>
 <form class="settings-form" id="settings-form">
 <section id="narration-fields">
 <label>Mesélői hőfok <span id="temp-value" class="muted"></span><input name="narrationTemperature" type="range" min="0.6" max="1" step="0.05"></label>
 <label class="check"><input name="adultTone" type="checkbox">Felnőtt hangnem</label>
 <small>A hőfok a változatosságot növeli; 0,85 a javasolt érték, 0,6 a legvisszafogottabb. 1,0 felett a modell hajlamos szétesni, ezért a csúszka felső értéke 1,0. A felnőtt hangnem a játék saját utasításait állítja be (felnőtt szereplők, moralizálás és kéretlen elsietés nélkül). A szolgáltató saját tartalmi szűrőjét nem írja felül, és a jelenetek tartalmáért a választott szolgáltató szabályai is felelősek.</small>
 </section>
 <label>Mesélő forrása<select name="provider"><option value="local">Helyi modell</option><option value="api">API-s mesélő</option></select></label>
 <section id="api-fields" hidden>
 <button type="button" id="deepseek-preset">DeepSeek beállítások</button>
 <label>API alapcíme<input name="apiBaseUrl" type="url" placeholder="https://api.deepseek.com"></label>
 <label>Modell neve<input name="apiModel" maxlength="200"></label>
 <label>API-kulcs<input name="apiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="Új kulcs; üresen hagyva a mentett marad"></label>
 <small id="key-status"></small>
 <label class="check"><input name="clearApiKey" type="checkbox">Mentett kulcs törlése (helyi módra váltással)</label>
 <p><small>API-módban a történet kontextusa a megadott szolgáltatóhoz kerül. A generálás annak díjazása szerint fogyasztja az egyenleget. A kulcsot a Windows-felhasználódhoz kötötten, titkosítva tároljuk.</small></p>
 </section><section id="local-fields">
 <div><label for="model-select">Modell</label><div class="model-choice-row"><select name="modelPath" id="model-select"></select><button type="button" id="browse-model">Tallózás…</button></div><small id="model-path" class="model-path"></small><small id="model-list-note"></small></div>
 <label>llama-server.exe útvonala<input name="runtimePath"></label>
 <div class="setup-grid"><label>Kontextus<select name="contextSize"><option>4096</option><option>8192</option><option>16384</option></select></label><label>GPU-ra töltött rétegek<input name="gpuLayers" type="number" min="0" max="999"></label></div>
 <small>99: minden elérhető réteg. Memóriahiba esetén csökkentsd, vagy használj kisebb kontextust. 0: CPU. Az első indítás előtt a MOTOR-TELEPITES.cmd telepíti a futtatót.</small>
 </section><div class="actions"><button type="submit">Beállítások mentése</button><button type="button" class="primary" id="start-ai">Mesélő indítása</button><button type="button" id="stop-ai">Leállítás</button></div></form>`);
 const form=document.getElementById('settings-form'),select=form.elements.modelPath,browse=document.getElementById('browse-model');
 document.getElementById('ai-status').textContent=status.status;
 form.elements.runtimePath.value=status.config.runtimePath;
 form.elements.contextSize.value=String(status.config.contextSize);
 form.elements.gpuLayers.value=String(status.config.gpuLayers);
 form.elements.provider.value=status.config.provider||'local';
 form.elements.apiBaseUrl.value=status.config.apiBaseUrl||'https://api.deepseek.com';
 form.elements.apiModel.value=status.config.apiModel||'deepseek-flash';
 const temperature=form.elements.narrationTemperature,tempValue=document.getElementById('temp-value');
 temperature.value=String(status.config.narrationTemperature??0.85);
 const showTemperature=()=>{tempValue.textContent=Number(temperature.value).toLocaleString('hu-HU',{minimumFractionDigits:2,maximumFractionDigits:2});};
 temperature.addEventListener('input',showTemperature);showTemperature();
 form.elements.adultTone.checked=status.config.adultTone!==false;
 document.getElementById('key-status').textContent=status.config.hasApiKey?'Van mentett API-kulcs.':'Még nincs mentett API-kulcs.';
 function mode(){const remote=form.elements.provider.value==='api';document.getElementById('api-fields').hidden=!remote;document.getElementById('local-fields').hidden=remote;document.getElementById('start-ai').textContent=remote?'Kapcsolat ellenőrzése':'Mesélő indítása';}
 form.elements.provider.onchange=mode;mode();
 document.getElementById('deepseek-preset').onclick=()=>{form.elements.apiBaseUrl.value='https://api.deepseek.com';form.elements.apiModel.value='deepseek-flash';};
 const entries=[...listing.models];
 const baseName=file=>file.split(/[\\/]/).pop();
 function addModel(model,external=false){
  const option=document.createElement('option');option.value=model.path;
  option.textContent=model.name+(model.sizeBytes?' · '+(model.sizeBytes/1e9).toLocaleString('hu-HU',{maximumFractionDigits:2})+' GB':'')+(external?' · külső modell':'');
  select.append(option);
 }
 for(const model of entries)addModel(model);
 const current=status.config.modelPath;
 if(current&&!entries.some(m=>m.path.toLowerCase()===current.toLowerCase()))addModel({path:current,name:baseName(current)},true);
 if(select.options.length===0){const empty=document.createElement('option');empty.value='';empty.textContent='Nincs modell a models mappában';select.append(empty);}
 select.value=current||entries[0]?.path||'';
 // Paths can differ only in case on Windows; use the discovered spelling.
 if(select.selectedIndex<0)select.value=entries.find(m=>m.path.toLowerCase()===current?.toLowerCase())?.path||select.options[0].value;
 function showPath(){document.getElementById('model-path').textContent=select.value||'Válassz GGUF modellt a Tallózás gombbal.';}
 select.addEventListener('change',showPath);showPath();
 document.getElementById('model-list-note').textContent=entries.length?`A models mappában ${entries.length} választható modell található.`:'A models mappa még nem tartalmaz választható GGUF modellt.';
 browse.onclick=async()=>{
  browse.disabled=true;const original=browse.textContent;browse.textContent='Kiválasztás…';
  try{
   const result=await api('/models/browse',{});if(result.cancelled)return;
   // The settings window may have been closed while the native picker was open.
   if(!form.isConnected)return;
   const model=result.model;let option=[...select.options].find(o=>o.value.toLowerCase()===model.path.toLowerCase());
   if(!option){if(select.options.length===1&&!select.options[0].value)select.replaceChildren();addModel(model,true);option=select.options[select.options.length-1];}
   select.value=option.value;showPath();
  }catch(e){notify(e.message);}finally{browse.disabled=false;browse.textContent=original;}
 };
 let working=false,checkedStatus='';
 async function save(){
  if(form.elements.provider.value==='local'&&!select.value&&!form.elements.clearApiKey.checked)throw Error('Válassz egy modellfájlt.');
  const data=Object.fromEntries(new FormData(form));data.clearApiKey=form.elements.clearApiKey.checked;
  data.adultTone=form.elements.adultTone.checked;data.narrationTemperature=Number(temperature.value);
  const result=await api('/settings',data);form.elements.apiKey.value='';form.elements.clearApiKey.checked=false;checkedStatus='';
  document.getElementById('key-status').textContent=result.config.hasApiKey?'Van mentett API-kulcs.':'Nincs mentett API-kulcs.';
 }
 async function action(fn){if(working)return;working=true;try{await fn();}catch(e){notify(e.message);}finally{working=false;}}
 form.onsubmit=e=>{e.preventDefault();action(async()=>{await save();notify('Beállítások elmentve.');});};
 document.getElementById('start-ai').onclick=()=>action(async()=>{await save();const remote=form.elements.provider.value==='api';if(!remote){clearInterval(statusPoll);await showModelLoading({api,notify});return;}const result=await api('/ai/check',{});checkedStatus=result.status;if(form.isConnected)document.getElementById('ai-status').textContent=checkedStatus;});
 document.getElementById('stop-ai').onclick=()=>action(async()=>{await api('/ai/stop',{});notify('A helyi motor leállt.');});
 statusPoll=setInterval(async()=>{if(!form.isConnected||!document.getElementById('modal').open){clearInterval(statusPoll);return;}try{const s=await api('/status');const el=document.getElementById('ai-status');if(form.isConnected&&el)el.textContent=checkedStatus||s.status;}catch{}},2500);
 document.getElementById('modal').addEventListener('close',()=>clearInterval(statusPoll),{once:true});
}
