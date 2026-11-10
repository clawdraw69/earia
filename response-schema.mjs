export function responseSchema(game,setup=false){
 const text=(maxLength=2200)=>({type:'string',maxLength});
 const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 const id={type:'string',enum:game.characters.map(c=>c.id)};
 const properties={
  messages:{type:'array',minItems:1,maxItems:6,items:object({speaker:{type:'string',enum:['narrator',...game.characters.filter(c=>c.id!==game.playerId).map(c=>c.id)]},text:text(2200)})},
  summary:text(700),location:text(120),elapsedMinutes:{type:'integer',minimum:0,maximum:10080},
  choices:{type:'array',minItems:2,maxItems:4,items:text(180)},memory:text(500),privateUpdate:text(500),
  events:{type:'array',maxItems:game.characters.length,items:object({characterId:id,contacts:{type:'object',additionalProperties:{type:'number',minimum:0,maximum:1}},directions:{type:'array',maxItems:2,items:{type:'string',enum:['male','female']}},reason:text(200)})},
  desireEvents:{type:'array',maxItems:24,items:{type:'object',properties:{characterId:id,kind:{type:'string',enum:['sleep_together','day_together','intense_touch','erogenous_give','erogenous_receive','nudity','scent']},partnerId:{type:'string',enum:[...game.characters.map(c=>c.id),'']},reason:text(120)},required:['characterId','kind'],additionalProperties:false}},
  candidate:{anyOf:[{type:'null'},object({name:text(60),description:text(400)})]}
 };
 if(setup){properties.privatePlan=object({objective:text(400),secrets:text(600),possibleEvents:text(800)});properties.initialStates={type:'array',minItems:game.characters.length,maxItems:game.characters.length,items:object({id,vf:{type:'number',minimum:1,maximum:7},vn:{type:'number',minimum:1,maximum:7}})};}
 return object(properties);
}
