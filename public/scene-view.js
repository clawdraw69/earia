import {t as tr} from "./i18n.js";
// Round and stamina display. The server handles round counting automatically; this is only a view.
// HU: Kör és stamina megjelenítés. A körszámlálás a szerveren automatikus; ez csak nézet.
export function seenKey(game){return 'earia.seen.'+(game?.id||'');}
export function readSeen(game){try{return Number(localStorage.getItem(seenKey(game))||0)||0;}catch{return 0;}}
export function markSeen(game){try{localStorage.setItem(seenKey(game),String(game.messages.length));}catch{}}

function chips(game,esc){
 return game.scene.members.map(m=>{
  const c=game.characters.find(x=>x.id===m.id);
  return `<span class="round-chip ${m.completed?'done':m.due?'due':''}">${esc(c?.name||'?')} · S ${m.stamina}</span>`;
 }).join('');
}
export function roundStrip(game,esc){
 if(!game.scene?.active)return '';
 return `<div class="round-strip"><strong>${game.scene.round}${tr(". kör</strong>")}${game.scene.round<=2?tr('<span class="muted">bemelegítés</span>'):''}${chips(game,esc)}</div>`;
}
function rows(game,esc){
 return game.scene.members.map(m=>{
  const c=game.characters.find(x=>x.id===m.id);
  const pct=Math.max(0,Math.min(100,m.stamina*10));
  const dirs=(m.directions||[]).map(d=>d==='male'?tr('férfi'):tr('női')).join('/');
  const contacts=Object.entries(m.contacts||{}).map(([k,v])=>v>0?`${k} ${v}`:'').filter(Boolean).join(', ');
  const state=c?`${tr(" · Vf ")}${c.state.vf.toFixed(2)}${tr(" · Vn ")}${c.state.vn.toFixed(2)}`:'';
return `<div class="round-member ${m.completed?'done':m.due?'due':''}"><div class="round-who"><strong>${esc(c?.name||'Ismeretlen')}</strong><span class="stam" aria-hidden="true"><i style="width:${pct}%"></i></span><small>S ${m.stamina} · ${contacts}${dirs?' · '+dirs:''}${state}</small></div>${m.completed?tr('<span class="badge">lezárt</span>'):m.due?tr('<span class="badge due">küszöb</span>'):''}</div>`;
 }).join('');
}
export function roundPanel(game,esc){
 if(!game.scene?.active)return `${tr("<div class=\"round-status\"><div class=\"eyebrow\">Körszámlálás</div><p class=\"muted\">Automatikus: amint a mesélő testi együttlétet jelez, itt jelenik meg a kör és a stamina.</p></div>")}`;
 return `${tr("<div class=\"round-status active\"><div class=\"eyebrow\">Körszámlálás</div><h3>")}${game.scene.round}${tr(". kör")}${game.scene.round<=2?tr(' · bemelegítés'):''}</h3>${rows(game,esc)}${tr("<small class=\"muted\">Alap terhelés: penetration/anal/vaginal −1/kör, oral/passive −0,5/kör; küszöbnél a következő körben történik az esemény.</small><div class=\"actions\"><button id=\"end-rounds-here\">Körszámlálás lezárása</button></div></div>")}`;
}
