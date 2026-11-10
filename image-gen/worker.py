"""One generation per process; stdout is newline-delimited JSON for the game."""
import os, sys, json, traceback
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
def event(**data):
    print(json.dumps(data,ensure_ascii=True),flush=True)
try:
    request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    event(phase='loading',message='Képmotor és modell betöltése…',percent=None)
    import torch
    from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline, DPMSolverMultistepScheduler
    from hardware import select_device
    device,reason=select_device(torch,Path(__file__).resolve().parent)
    dtype=torch.float16 if device=='cuda' else torch.float32
    event(phase='loading',message=reason,percent=None)
    torch.set_num_threads(min(8,os.cpu_count() or 4))
    models=Path(os.environ.get('EARIA_IMAGE_MODELS',Path(__file__).resolve().parent/'models'))
    pony=request.get('model')=='pony-v6-xl'
    if pony:
        pipe=StableDiffusionXLPipeline.from_single_file(
            str(models/'pony-v6-xl'/'ponyDiffusionV6XL_v6StartWithThisOne.safetensors'),
            config=str(models/'pony-v6-xl'/'config'),torch_dtype=dtype,local_files_only=True)
    elif request.get('model')=='yiffymix':
        # SD1.5 checkpoint; a komponensek (tokenizer, text encoder, VAE) az sd15 mappából.
        pipe=StableDiffusionPipeline.from_single_file(
            str(models/'yiffymix'/'yiffymix.safetensors'),config=str(models/'sd15'),
            torch_dtype=dtype,local_files_only=True,
            safety_checker=None,requires_safety_checker=False)
    else:
        # Helyi, felnőtteknek szóló játék: a modell saját ellenőrzője nélkül töltjük be.
        pipe=StableDiffusionPipeline.from_pretrained(str(models/'sd15'),
            torch_dtype=dtype,variant='fp16',use_safetensors=True,local_files_only=True,
            safety_checker=None,requires_safety_checker=False)
    reference_args={}
    style=request.get('styleReference')
    if request.get('references') or style:
        adapter=models/'ip-adapter'
        from transformers import CLIPVisionModelWithProjection
        pipe.image_encoder=CLIPVisionModelWithProjection.from_pretrained(
            str(adapter/'models'/'image_encoder'),torch_dtype=dtype,local_files_only=True)
        pipe.load_ip_adapter(str(adapter),subfolder='sdxl_models' if pony else 'models',
            weight_name='ip-adapter-plus_sdxl_vit-h.safetensors' if pony else 'ip-adapter-plus_sd15.safetensors',
            image_encoder_folder=None,local_files_only=True)
    if request.get('references'):
        from PIL import Image, ImageDraw
        from diffusers.image_processor import IPAdapterMaskProcessor
        images=[]
        for file in request['references']:
            with Image.open(file) as source:
                # Keep the whole silhouette rather than CLIP's default central crop.
                source=source.convert('RGB')
                side=max(source.size)
                square=Image.new('RGB',(side,side),(240,240,240))
                square.paste(source,((side-source.width)//2,(side-source.height)//2))
                images.append(square)
        count=len(images)
        pipe.set_ip_adapter_scale([[request.get('referenceStrength',0.65)]*count])
        masks=[]
        for i in range(count):
            mask=Image.new('L',(request['width'],request['height']),0)
            if count==1:
                ImageDraw.Draw(mask).rectangle((0,0,request['width'],request['height']),fill=255)
                masks.append(mask)
                continue
            x0=int(request['width']*(0.06+0.5*i))
            x1=int(request['width']*(0.44+0.5*i))
            ImageDraw.Draw(mask).rectangle((x0,0,x1,request['height']),fill=255)
            masks.append(mask)
        masks=IPAdapterMaskProcessor().preprocess(masks,height=request['height'],width=request['width'])
        masks=[masks.reshape(1,count,masks.shape[2],masks.shape[3])]
        reference_args={'ip_adapter_image':[images],'cross_attention_kwargs':{'ip_adapter_masks':masks}}
    elif style:
        from PIL import Image
        with Image.open(style) as source:
            source=source.convert('RGB')
            side=max(source.size)
            square=Image.new('RGB',(side,side),(240,240,240))
            square.paste(source,((side-source.width)//2,(side-source.height)//2))
        pipe.set_ip_adapter_scale(float(request.get('styleStrength',0.55)))
        reference_args={'ip_adapter_image':[square]}
    pipe.scheduler=DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    if device=='cuda':
        pipe.enable_model_cpu_offload()
    else:
        pipe.to('cpu')
        pipe.enable_attention_slicing()
    pipe.vae.enable_slicing()
    pipe.vae.enable_tiling()
    pipe.set_progress_bar_config(disable=True)
    maxlen=pipe.tokenizer.model_max_length
    if len(pipe.tokenizer(request['prompt'],truncation=False).input_ids)>maxlen:
        # A túl hosszú promptot szóhatáron vágjuk a modell keretére (a tagek sorrendje számít).
        words=request['prompt'].split()
        while words and len(pipe.tokenizer(' '.join(words)).input_ids)>maxlen: words.pop()
        request['prompt']=' '.join(words)
        event(phase='loading',message='A képleírás a modell keretére rövidítve.',percent=None)
    def progress(pipeline,step,timestep,kwargs):
        event(phase='generating',percent=round((step+1)/request['steps']*100),message=f"Kép készül: {step+1}/{request['steps']} lépés")
        return kwargs
    result=pipe(prompt=request['prompt'],negative_prompt=request['negative'],
        width=request['width'],height=request['height'],num_inference_steps=request['steps'],
        guidance_scale=request['guidance'],generator=torch.Generator('cpu').manual_seed(request['seed']),
        callback_on_step_end=progress,**reference_args)
    event(phase='finishing',percent=100,message='Kép ellenőrzése és előnézet mentése…')
        # Nincs utólagos NSFW-szűrés: a helyi modell explicit tartalomra van használva.
    result.images[0].save(request['output'],format='PNG')
    event(phase='done',percent=100,message='A kép elkészült.')
except Exception as exc:
    traceback.print_exc(file=sys.stderr)
    event(phase='error',message=str(exc)[:700])
    sys.exit(1)
