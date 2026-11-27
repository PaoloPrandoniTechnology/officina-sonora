# Aggiorna screenshot e repository GitHub in un solo passo.
# Uso: powershell -ExecutionPolicy Bypass -File tools\pubblica.ps1 -Messaggio "Descrizione della modifica"
# 1) rigenera gli screenshot della dashboard (se il gateway risponde)
# 2) committa tutte le modifiche (senza file sensibili) e le invia a GitHub
param([Parameter(Mandatory = $true)][string]$Messaggio)
$ErrorActionPreference = 'Continue'
$radice = Split-Path -Parent $PSScriptRoot
Set-Location $radice

# Diagramma del flusso n8n: dal file del workflow, poi PNG
node (Join-Path $PSScriptRoot 'diagramma.mjs') | Out-Null
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (Test-Path $chrome) {
  $svg = Join-Path $radice 'docs\flusso-n8n.svg'
  $raw = Get-Content $svg -Raw
  $w = [regex]::Match($raw, 'width="(\d+)"').Groups[1].Value
  $h = [regex]::Match($raw, 'height="(\d+)"').Groups[1].Value
  & $chrome --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir="$env:TEMP\ymf-svg-profile" "--window-size=$w,$h" "--screenshot=$(Join-Path $radice 'docs\flusso-n8n.png')" ('file:///' + $svg.Replace('\', '/')) 2>$null | Out-Null
  Write-Output 'diagramma del flusso aggiornato'
}

# Screenshot della dashboard (solo se il gateway risponde)
try {
  $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5790/api/controllo' -UseBasicParsing -TimeoutSec 10
  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'screenshot.ps1') | Out-Null
  Write-Output 'screenshot aggiornati'
} catch {
  Write-Warning 'gateway non attivo: screenshot non aggiornati'
}

git add -A
$segreti = git diff --cached --name-only | Select-String -Pattern 'secrets|token\.json|dpapi|^state/|node_modules|telegram\.json'
if ($segreti) { Write-Error "File sensibili nella modifica: $segreti"; git reset -q; exit 1 }

if (git diff --cached --quiet) {
  Write-Output 'nessuna modifica da pubblicare'
  exit 0
}
git commit -q -m "$Messaggio`n`nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin master
git log --oneline -1
