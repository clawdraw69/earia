import {AsyncLocalStorage} from 'node:async_hooks';
import {normalizeLanguage,translate} from './i18n-core.mjs';
const context=new AsyncLocalStorage();
export function language(){return context.getStore()||'hu';}
export function t(text){return translate(text,language());}
export function withLanguage(req,run){
 const requested=req.headers['x-earia-language'];
 return context.run(normalizeLanguage(requested,normalizeLanguage(process.env.EARIA_LANGUAGE)),run);
}
