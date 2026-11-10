export const CLANS = ['Ursa','Wulf','Boszorkány','Taur','Lio','Vulpi'];
export const LABELS = {male:['Teltség','Fenék','Farokméret','Előváladék','Sperma','Kitartás (K)','Libidó (N)'],female:['Teltség','Fenék','Mellméret','Nedvesség','Squirt','Kitartás (K)','Libidó (N)']};
const ORDER=['Vulpi','Lio','Taur','Wulf','Ursa'];
const LOW={male:[[2,1,3,5,6],[2,1,2,4,5],[2,4,5,5,6],[2,3,4,6,4],[2,5,5,5,6],[2,6,1,2,4],[2,6,5,6,1]],female:[[2,2,2,4,6],[2,1,3,4,5],[2,3,5,5,6],[2,4,6,6,4],[2,1,6,5,2],[2,1,5,3,4],[2,2,5,6,2]]};
export const BLESSINGS=['Hold-éhség','Dupla ejakuláció','Papi mágia érzékenység','Termékeny vér','Tömör vér','Bőséges mag','Mell-érzékenység'];
export function ranges(clan,sex){if(!CLANS.includes(clan)||!['male','female'].includes(sex)||clan==='Boszorkány'&&sex!=='female')throw Error('Érvénytelen klán vagy nem.');return clan==='Boszorkány'?Array.from({length:7},()=>[3,7]):LOW[sex].map(row=>[row[ORDER.indexOf(clan)],Math.min(7,row[ORDER.indexOf(clan)]+2)]);}
export function cost(value,[lo,hi]){const d=Math.max(lo-value,value-hi,0);return [0,2,4,10][d]??Infinity;}
export function validateCharacter(raw){if(!raw||typeof raw!=='object')throw Error('Hiányzó karakter.');const name=String(raw.name??'').trim();if(!name||name.length>60)throw Error('Adj meg legfeljebb 60 karakteres nevet.');const age=Number(raw.age);if(!Number.isInteger(age)||age<18||age>200)throw Error('A karakter kora 18–200 év lehet.');const rs=ranges(raw.clan,raw.sex);if(!Array.isArray(raw.stats)||raw.stats.length!==7||raw.stats.some(v=>!Number.isInteger(v)||v<1||v>7))throw Error('A tulajdonságok egész értékek 1 és 7 között.');const blessings=[...new Set(raw.blessings??[])];if(blessings.some(b=>!BLESSINGS.includes(b)))throw Error('Ismeretlen áldás.');const spent=raw.stats.reduce((s,v,i)=>s+cost(v,rs[i]),0)+3*blessings.length;if(spent>10)throw Error('Túllépted a 10 pontos keretet.');const orientation=Number(raw.orientation);if(!Number.isInteger(orientation)||orientation<1||orientation>7)throw Error('Érvénytelen vonzalomérték.');
 const primaryZones=['anal'];
 if(raw.sex==='male')primaryZones.push('penis');
 if(raw.sex==='female')primaryZones.push('vaginal');
 if(blessings.includes('Mell-érzékenység'))primaryZones.push('nipple');
 return {name,age,clan:raw.clan,sex:raw.sex,stats:[...raw.stats],blessings,orientation,description:String(raw.description??'').slice(0,4000),unspent:10-spent,primaryZones};}
export function calendar(minutes){const t=minutes/1440,absolute=Math.floor(t),day=absolute%28+1;return {year:Math.floor(absolute/336)+1,month:Math.floor(absolute/28)%12+1,day,hour:Math.floor(minutes%1440/60),minute:Math.floor(minutes%60),gold:14*Math.cos(2*Math.PI*t/28),blue:14*Math.cos(2*Math.PI*t/7),goldAngle:t/28*360,blueAngle:t/7*360,feral:[8,15,22].includes(day),nextFeral:([8,15,22].find(v=>v>day)??36),doubleFull:day===1};}
export function initialStamina(c, dominantDesire) {
  const effectiveDesire = Math.min(7, dominantDesire);
  return Math.max(3, Math.floor(c.stats[5] - (effectiveDesire / 3)));
}
export function orientationWeights(c){
 const w=Math.max(0,Math.min(1,((Number(c.orientation)||1)-1)/6));
 const toMen=c.sex==='female'?1-w:w;
 return {toMen,toWomen:1-toMen};
}
export function desiredState(c,heat=1){
 const h=Math.max(1,Math.min(7,Number(heat)||1));
 const {toMen,toWomen}=orientationWeights(c);
 if(Math.abs(toMen-toWomen)<0.1)return {vf:h,vn:h};
 if(toMen>toWomen)return {vf:h,vn:Math.max(1,Math.round(1+(h-1)*toWomen))};
 return {vf:Math.max(1,Math.round(1+(h-1)*toMen)),vn:h};
}export function seedDesire(c,d={}){
 const clamp=v=>Math.max(1,Math.min(7,Math.round(Number(v)||1)));
 const o=Number(c.orientation)||1;
 if(o<=1||o>=7){
  const {toMen}=orientationWeights(c);
  return desiredState(c,toMen>=0.5?clamp(d.vf):clamp(d.vn));
 }
 return {vf:clamp(d.vf),vn:clamp(d.vn)};
}

export function advanceTime(game,minutes){if(!Number.isFinite(minutes)||minutes<0||minutes>10080)throw Error('Érvénytelen időlépés.');const old=game.minutes;game.minutes+=Math.round(minutes);const days=Math.floor(game.minutes/1440)-Math.floor(old/1440);if(days>0&&!game.scene.active)for(const c of game.characters){const female=c.sex==='female';const w=(c.orientation-1)/6;const maleWeight=female?1-w:w;const delta=c.stats[6]/10*days;c.state.vf=Math.min(7,Math.round((c.state.vf+delta*maleWeight)*100)/100);c.state.vn=Math.min(7,Math.round((c.state.vn+delta*(1-maleWeight))*100)/100);}}
// Temporary, visible defaults: penetration, anal and vaginal cost 1 stamina per round,
// oral and passive 0.5; reaching 1 triggers the threshold event on the following round,
// after two warm-up rounds.
export function startScene(game){
  if(game.scene.active)throw Error('Már aktív a körkövetés.');
  const participantSexes = new Set(game.characters.map(c => c.sex));
  const hasMale = participantSexes.has('male');
  const hasFemale = participantSexes.has('female');
  game.scene = {
    active: true,
    round: 0,
    members: game.characters.map(c => {
      let relevantDesire;
      if (hasMale && hasFemale) {
        relevantDesire = Math.max(c.state.vf, c.state.vn);
      } else if (hasMale) {
        relevantDesire = c.state.vf;
      } else {
        relevantDesire = c.state.vn;
      }
      return {
        id: c.id,
        stamina: initialStamina(c, relevantDesire),
        rate: 0,
        due: false,
        completed: false,
        directions: [],
        contacts: {}
      };
    })
  };
}
export function stepScene(game,contactsList){
 if(!game.scene.active)throw Error('Nincs aktív jelenet.');
 const members=game.scene.members;
 if(!Array.isArray(contactsList)||contactsList.length!==members.length)throw Error('Hiányzó köradatok.');
 game.scene.round++;
 const log=[];
 for(const m of members){
  const r=contactsList.find(v=>v.id===m.id);
  m.contacts=r.contacts||{};
  m.directions=r.directions||[];
  if(m.completed)continue;
  if(game.scene.round<=2)continue;
  if(m.due){
   m.completed=true;
   const c=game.characters.find(v=>v.id===m.id);
   for(const d of ['male','female']){
    const key=d==='male'?'vf':'vn';
    c.state[key]=m.directions.includes(d)?1:Math.max(1,c.state[key]-2);
   }
   log.push(c.name+': küszöbesemény, állapot frissítve.');
   continue;
  }
  let loss=0;
  const character=game.characters.find(v=>v.id===m.id);
  for(const [type,count] of Object.entries(m.contacts)){
   const c=Number(count)||0;
   if(c<=0)continue;
   // Ha a zóna a karakter elsődleges nemi szerve (fogadó fél), -1.
   // Ha nem (adó fél, pl. orális adás), -0.5.
   if(character.primaryZones?.includes(type)){
     loss+=1;
   } else {
     loss+=0.5;
   }
  }
  m.stamina=Math.max(1,m.stamina-loss);
  if(m.stamina<=1&&loss>0)m.due=true;
 }
 return log;
}
// Vágy-növekedés jeleneten kívül. A modell csak címkéz, a számokat itt adjuk.
export const DESIRE_KINDS={sleep_together:0.2,day_together:0.2,intense_touch:0.2,erogenous_give:0.2,erogenous_receive:0.3,erogenous_extra:0.1,nudity:0.1,scent:0.1};
export const DESIRE_TURN_CAP=0.5;
export function applyDesireEvents(game,events){
 if(!Array.isArray(events)||!events.length)return [];
 if(game.scene?.active)return []; // aktus közben nincs vágyváltozás, csak stamina
 const day=Math.floor((Number(game.minutes)||0)/1440);
 if(!game.desireMarks||game.desireMarks.day!==day)game.desireMarks={day,sleep:[],together:[]};
 const marks=game.desireMarks;
 const perChar=new Map();
 const receives=new Map();
 const add=(id,axis,amount)=>{
  if(!id||!axis)return;
  const d=perChar.get(id)||{vf:0,vn:0};
  d[axis]+=amount;
  perChar.set(id,d);
 };
 for(const e of events){
  if(!e||typeof e!=='object')continue;
  if(e.kind==='erogenous_extra')continue;
  const c=game.characters.find(x=>x.id===e.characterId);
  if(!c)continue;
  const partner=e.partnerId?game.characters.find(x=>x.id===e.partnerId):null;
  let axis;
  if(partner)axis=partner.sex==='male'?'vf':'vn';
  else{const w=Math.max(0,Math.min(1,((Number(c.orientation)||1)-1)/6));axis=(w>=0.5?'vf':'vn');}
  switch(e.kind){
   case 'sleep_together':
    if(!marks.sleep.includes(c.id)){marks.sleep.push(c.id);add(c.id,axis,DESIRE_KINDS.sleep_together);}
    break;
   case 'day_together':
    if(!marks.together.includes(c.id)){marks.together.push(c.id);add(c.id,axis,DESIRE_KINDS.day_together);}
    break;
   case 'intense_touch': add(c.id,axis,DESIRE_KINDS.intense_touch); break;
   case 'erogenous_give': add(c.id,axis,DESIRE_KINDS.erogenous_give); break;
   case 'erogenous_receive': {
    const n=(receives.get(c.id)||0)+1;
    receives.set(c.id,n);
    add(c.id,axis,n===1?DESIRE_KINDS.erogenous_receive:DESIRE_KINDS.erogenous_extra);
    break;
   }
   case 'nudity': add(c.id,axis,DESIRE_KINDS.nudity); break;
   case 'scent': add(c.id,axis,DESIRE_KINDS.scent); break;
   default: break;
  }
 }
 const applied=[];
 for(const [id,d] of perChar){
  const c=game.characters.find(x=>x.id===id);
  if(!c||!c.state)continue;
  let vf=d.vf,vn=d.vn;
  const total=vf+vn;
  if(total>DESIRE_TURN_CAP){const k=DESIRE_TURN_CAP/total;vf*=k;vn*=k;}
  const before={vf:c.state.vf,vn:c.state.vn};
  if(vf>0)c.state.vf=Math.min(7,Math.round((c.state.vf+vf)*100)/100);
  if(vn>0)c.state.vn=Math.min(7,Math.round((c.state.vn+vn)*100)/100);
  if(c.state.vf!==before.vf||c.state.vn!==before.vn)applied.push({id,name:c.name,from:before,to:{vf:c.state.vf,vn:c.state.vn}});
 }
 return applied;
}
