# Aggiorna gli screenshot a pagina intera della dashboard in docs\screenshots (vedi tools\screenshot.mjs).
# Uso: powershell -ExecutionPolicy Bypass -File tools\screenshot.ps1
# Richiede che il gateway sia attivo su 127.0.0.1:5790.
$ErrorActionPreference = 'Stop'
try { Invoke-WebRequest -Uri 'http://127.0.0.1:5790/dashboard' -UseBasicParsing -TimeoutSec 10 | Out-Null }
catch { throw 'Il gateway non risponde: avvia l''automazione prima di fare gli screenshot' }
& node (Join-Path $PSScriptRoot 'screenshot.mjs')
if ($LASTEXITCODE -ne 0) { throw 'screenshot non riusciti' }
Write-Output 'Screenshot aggiornati in docs\screenshots'
