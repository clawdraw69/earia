export async function confirmSaveDeletion(save,{confirm=message=>globalThis.confirm(message),remove}){
 const accepted=confirm(`Biztosan törölni szeretnéd ezt a mentést?\n\n${save.title}\nJátékos: ${save.player}\n\nA teljes történet, a karakterek, avatárok és a mentéshez tartozó képek végleg törlődnek.`);
 if(!accepted)return false;
 await remove(save.id,{confirmed:true,confirmationId:save.id});
 return true;
}
