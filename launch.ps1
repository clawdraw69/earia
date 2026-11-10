$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'config.json')) { Copy-Item -LiteralPath 'config.example.json' -Destination 'config.json' }
if (-not (Test-Path -LiteralPath 'image-gen/installed.json') -or -not (Test-Path -LiteralPath 'image-gen/runtime/python.exe')) {
    Write-Host 'A kepmotor meg nincs telepitve. Az API-s jatek enelkul is elindul.'
    if ((Read-Host 'Telepitsem most a helyi kepmotort? [I/N]') -match '^[iIyY]') {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup-images.ps1') -Yes
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'A kepmotor telepitese nem sikerult. A jatek elindul; kesobb futtasd a KEP_MOTOR_TELEPITES.cmd-t.'
            Read-Host 'Enter a folytatashoz'
        }
    }
}
$env:EARIA_PORT = '43141'
$env:EARIA_AI_PORT = '43142'
$url = 'http://127.0.0.1:43141'
$running = $false
try {
    $status = Invoke-RestMethod -Uri "$url/api/status" -TimeoutSec 2
    if ($status.version -ne '0.5.0') { throw 'Mas verzio foglalja a 43141 portot.' }
    $running = $true
} catch { if ($_.Exception.Message -like '*Mas verzio*') { throw } }
if (-not $running) {
    $nodeExe = Join-Path $PSScriptRoot 'runtime/node.exe'
    New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'logs') -Force | Out-Null
    Start-Process -FilePath $nodeExe -ArgumentList @('server.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'logs/app.log') -RedirectStandardError (Join-Path $PSScriptRoot 'logs/app-error.log')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $status = Invoke-RestMethod -Uri "$url/api/status" -TimeoutSec 2; $running = $status.version -eq '0.5.0'; if ($running) { break } } catch {}
    }
    if (-not $running) { throw 'Az Earia nem indult el. Lasd logs/app-error.log.' }
}
$edgePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft/Edge/Application/msedge.exe'
if (Test-Path -LiteralPath $edgePath) { Start-Process -FilePath $edgePath -ArgumentList "--app=$url" } else { Start-Process $url }
