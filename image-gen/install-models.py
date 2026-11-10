"""Pinned, resumable downloads. Does not download YiffyMix or upload user files."""
import argparse
import json
import os
from pathlib import Path
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parent / 'models'


def download(repo, revision, directory, patterns, metadata):
    destination = ROOT / directory
    print(f'Downloading {repo} -> {destination}', flush=True)
    snapshot_download(repo, revision=revision, local_dir=destination, allow_patterns=patterns)
    (ROOT / metadata).write_text(json.dumps({'repo': repo, 'revision': revision}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--models', choices=['base', 'references', 'pony'], default='references')
    args = parser.parse_args()
    download('stable-diffusion-v1-5/stable-diffusion-v1-5', '451f4fe16113bff5a5d2269ed5ad43b0592e9a14', 'sd15',
             ['model_index.json', 'scheduler/*', 'tokenizer/*', 'feature_extractor/*', '*/config.json', '*/*.fp16.safetensors', 'README.md', 'LICENSE*'], 'source.json')
    if args.models in ('references', 'pony'):
        patterns = ['models/image_encoder/config.json', 'models/image_encoder/model.safetensors',
                    'models/ip-adapter-plus_sd15.safetensors', 'README.md', 'LICENSE*']
        if args.models == 'pony':
            patterns.append('sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors')
        download('h94/IP-Adapter', '018e402774aeeddd60609b4ecdb7e298259dc729', 'ip-adapter', patterns, 'ip-adapter/source.json')
    if args.models == 'pony':
        download('stabilityai/stable-diffusion-xl-base-1.0', '462165984030d82259a11f4367a4eed129e94a7b', 'pony-v6-xl/config',
                 ['model_index.json', 'scheduler/*', 'tokenizer/*', 'tokenizer_2/*', '*/config.json', 'README.md', 'LICENSE*'], 'pony-v6-xl/config-source.json')
        download('Runware/Pony_Diffusion_V6_XL', '98750dba5dadb9c98828da7a3ab3b47c968dae1b', 'pony-v6-xl',
                 ['ponyDiffusionV6XL_v6StartWithThisOne.safetensors', 'README.md', 'LICENSE*'], 'pony-v6-xl/source.json')
    print('Model installation complete.', flush=True)
