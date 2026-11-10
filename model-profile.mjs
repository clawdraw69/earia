// Google recommends these Gemma 4 sampling settings across use cases.
// https://ai.google.dev/gemma/docs/core/model_card_4#best-practices
export function samplingForModel(modelPath){
 // Local Hungarian prose test: gentler than the vendor's generic non-thinking profile.
 if(/qwen3[._ -]?6/i.test(modelPath))return {temperature:.4,top_p:.9,top_k:20,min_p:0,presence_penalty:0,repeat_penalty:1};
 return /gemma[-_ ]?4/i.test(modelPath)
  ? {temperature:1.0,top_p:.95,top_k:64}
  : {temperature:.6};
}
