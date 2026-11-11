import {t as tr} from "./i18n.mjs";
import {apiBase} from './api-provider.mjs';
import {protectKey} from './api-secret.mjs';
export async function nextSettings(current,b,protect=protectKey){
 const provider=b.provider??current.provider??'local';if(!['local','api'].includes(provider))throw Error(tr('Ismeretlen mesélőforrás.'));
 const temperature=Math.min(1,Math.max(0.6,Number(b.narrationTemperature??current.narrationTemperature??0.85)||0.85));
 const adultTone=b.adultTone===undefined?(current.adultTone!==false):[true,1,'1','on','true'].includes(b.adultTone);
 const next={...current,provider,modelPath:String(b.modelPath??current.modelPath),runtimePath:String(b.runtimePath??current.runtimePath),contextSize:Math.max(2048,Math.min(16384,Number(b.contextSize??current.contextSize)||8192)),gpuLayers:Math.max(0,Math.min(999,Number(b.gpuLayers??current.gpuLayers)||0)),apiBaseUrl:apiBase(b.apiBaseUrl??current.apiBaseUrl),apiModel:String(b.apiModel??current.apiModel).trim(),narrationTemperature:temperature,adultTone};
 if(!next.apiModel||next.apiModel.length>200)throw Error(tr('Adj meg egy érvényes API-modellnevet.'));
 if(next.apiBaseUrl!==current.apiBaseUrl||b.clearApiKey===true)next.apiKeyEncrypted='';
 const key=typeof b.apiKey==='string'?b.apiKey.trim():'';
 if(key){if(key.length>4096||/\s/.test(key))throw Error(tr('Érvénytelen API-kulcs.'));next.apiKeyEncrypted=await protect(key);}
 if(provider==='api'&&!next.apiKeyEncrypted)throw Error(tr('Add meg az API-kulcsot. Új API-címhez újra meg kell adnod.'));
 return next;
}
