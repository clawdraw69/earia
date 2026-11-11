import {t as tr} from "./i18n.js";
export async function confirmSaveDeletion(save,{confirm=message=>globalThis.confirm(message),remove}){
 const accepted=confirm(`${tr("Biztosan törölni szeretnéd ezt a mentést?\n\n")}${save.title}${tr("\nJátékos: ")}${save.player}${tr("\n\nA teljes történet, a karakterek, avatárok és a mentéshez tartozó képek végleg törlődnek.")}`);
 if(!accepted)return false;
 await remove(save.id,{confirmed:true,confirmationId:save.id});
 return true;
}
