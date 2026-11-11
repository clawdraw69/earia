// Position the New messages marker at the first non-player message after the
// HU: Az „Új üzenetek” jelölő helye: a legutóbb látott állapot utáni első olyan
// last seen state. No marker on first opening or for the player's own message.
// HU: üzenet, amit nem a játékos írt. Első megnyitáskor és saját üzenetnél nincs jelölő.
export function newDividerIndex(messages,seen,playerId){
 if(!Array.isArray(messages)||messages.length<=seen||seen<=0)return -1;
 for(let i=Math.max(0,Math.min(seen,messages.length-1));i<messages.length;i++){
  if(messages[i]?.speaker!==playerId)return i;
 }
 return -1;
}
