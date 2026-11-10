param(
    [ValidateSet('auto','cpu','cuda')][string]$Device = 'auto',
    [ValidateSet('base','references','pony','none')][string]$Models = 'references',
    [switch]$Yes,
    [switch]$PythonOnly
)
$ErrorActionPreference = 'Stop'
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Windows x64 szukseges; ARM nem tamogatott.' }
$root = $PSScriptRoot
$engine = Join-Path $root 'image-gen'
$runtime = Join-Path $engine 'runtime'
$cache = Join-Path $engine '.downloads'
$python = Join-Path $runtime 'python.exe'
New-Item -ItemType Directory -Force -Path $runtime,$cache,(Join-Path $root 'logs') | Out-Null
Start-Transcript -Path (Join-Path $root 'logs/setup-images.log') -Append | Out-Null
if (-not $Yes) {
    Write-Host 'Helyi kepmotor telepitese: Python, PyTorch, Diffusers es a kivalasztott modellek.'
    Write-Host 'Letoltes tobb GB; alap+referenciak CPU-val kb. 7 GB, CUDA-val tobb.'
    Write-Host 'Nem kell ComfyUI, kulon Python, Git vagy CUDA Toolkit. YiffyMixet kezzel masold be.'
    if ((Read-Host 'Folytatod? [I/N]') -notmatch '^[iIyY]') { exit 2 }
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Fetch([string]$Url,[string]$Destination) {
    Write-Host "Letoltes: $Url"
    $partial = "$Destination.part"
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $partial
    Move-Item -LiteralPath $partial -Destination $Destination -Force
}
function RunPython([string[]]$Arguments) {
    & $python @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Python lepes sikertelen (kod: $LASTEXITCODE). Javitsd a fenti hibat, majd inditsd ujra a telepitot." }
}
if (-not (Test-Path -LiteralPath $python)) {
    $zip = Join-Path $cache 'python-3.13.12-embed-amd64.zip'
    $sha = '76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0'
    if (-not (Test-Path -LiteralPath $zip) -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $sha) {
        Fetch 'https://www.python.org/ftp/python/3.13.12/python-3.13.12-embed-amd64.zip' $zip
    }
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $sha) { throw 'A Python fajl ellenorzoosszege nem egyezik.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $runtime -Force
}
# Embedded Python: explicit local imports, never a user's global Python environment.
"python313.zip`n.`n..`nLib/site-packages`nimport site`n" | Set-Content -LiteralPath (Join-Path $runtime 'python313._pth') -Encoding ASCII
New-Item -ItemType Directory -Force -Path (Join-Path $runtime 'Lib/site-packages') | Out-Null
$env:PYTHONIOENCODING = 'utf-8'
$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'
$env:PIP_CACHE_DIR = Join-Path $cache 'pip-cache'
& $python -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('pip') else 1)"
if ($LASTEXITCODE -ne 0) {
    $pip = Join-Path $cache 'pip.pyz'
    Fetch 'https://bootstrap.pypa.io/pip/pip.pyz' $pip
    RunPython @($pip,'install','--only-binary=:all:','--no-warn-script-location','pip==26.0')
}
if ($PythonOnly) { Write-Host 'Helyi Python es pip kesz.'; exit 0 }
$backend = $Device
if ($backend -eq 'auto') {
    $backend = 'cpu'
    if (Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue) {
        & nvidia-smi.exe -L *> $null
        if ($LASTEXITCODE -eq 0) { $backend = 'cuda' }
    }
}
$index = 'https://download.pytorch.org/whl/cpu'
$suffix = '+cpu'
if ($backend -eq 'cuda') { $index = 'https://download.pytorch.org/whl/cu128'; $suffix = '+cu128' }
Write-Host "PyTorch telepitese: $backend (elso alkalommal hosszabb letoltes)."
RunPython @('-m','pip','install','--only-binary=:all:',"torch==2.11.0$suffix","torchvision==0.26.0$suffix",'--index-url',$index)
RunPython @('-m','pip','install','--only-binary=:all:','-r',(Join-Path $engine 'requirements.txt'))
"{`"device`":`"$Device`"}" | Set-Content -LiteralPath (Join-Path $engine 'device.json') -Encoding ASCII
RunPython @('-c','import torch, diffusers, transformers, accelerate, hardware; from pathlib import Path; print(hardware.select_device(torch, Path(hardware.__file__).parent))')
if ($Models -ne 'none') { RunPython @((Join-Path $engine 'install-models.py'),'--models',$Models) }
# Written only after successful imports and requested downloads. A failed run can be retried.
"{`"backend`":`"$backend`",`"models`":`"$Models`",`"version`":1}" | Set-Content -LiteralPath (Join-Path $engine 'installed.json') -Encoding ASCII
Write-Host 'Kepmotor kesz. Inditsd az INDITAS.cmd-t.'
if (-not (Test-Path -LiteralPath (Join-Path $engine 'models/yiffymix/yiffymix.safetensors'))) {
    Write-Host 'YiffyMix nincs bemasolva. Az alap SD1.5 ettol meg hasznalhato (ha letoltotted).'
}

