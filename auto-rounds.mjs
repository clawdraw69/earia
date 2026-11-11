import {startScene,stepScene} from './rules.mjs';
// The narrator's suggested events automatically start and advance the round counter.
// HU: A mesélő events javaslata automatikusan indítja és lépteti a körszámlálást.
// contacts is an object: keys are zones (passive, oral, vaginal, anal, penis, nipple); values are stimulus counts.
// HU: A contacts egy objektum: kulcs a zóna (passive, oral, vaginal, anal, penis, nipple), érték az ingerek száma.
export function applyRoundEvents(game,events=[]){
 const list=Array.isArray(events)?events:[];
 const rated=list.filter(e=>e&&e.contacts&&typeof e.contacts==='object'&&Object.keys(e.contacts).length>0);
 if(!rated.length)return {active:Boolean(game.scene?.active),started:false,round:game.scene?.round??0,log:[]};
 const started=!game.scene?.active;
 try{
  if(started)startScene(game);
  const contacts=game.scene.members.map(m=>{
   const event=rated.find(x=>x.characterId===m.id);
   return {id:m.id,contacts:event?event.contacts:{},directions:Array.isArray(event?.directions)?event.directions.filter(d=>d==='male'||d==='female'):[]};
  });
  const log=stepScene(game,contacts);
  return {active:true,started,round:game.scene.round,log};
 }catch(error){return {active:Boolean(game.scene?.active),started:false,round:game.scene?.round??0,log:[],error:error.message};}
}
