# Aggiorna gli screenshot della dashboard in docs\screenshots (usa Chrome o Edge in modalita' headless).
# Uso: powershell -ExecutionPolicy Bypass -File tools\screenshot.ps1
# Richiede che il gateway sia attivo su 127.0.0.1:5790.
$ErrorActionPreference = 'Stop'
$radice = Split-Path -Parent $PSScriptRoot
$cartella = Join-Path $radice 'docs\screenshots'
New-Item -ItemType Directory -Force -Path $cartella | Out-Null

$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome o Edge non trovati' }

try { Invoke-WebRequest -Uri 'http://127.0.0.1:5790/dashboard' -UseBasicParsing -TimeoutSec 10 | Out-Null }
catch { throw 'Il gateway non risponde: avvia l''automazione prima di fare gli screenshot' }

$pagine = @(
  @{ n = '01-panoramica';        h = 'panoramica' },
  @{ n = '02-render';            h = 'render' },
  @{ n = '03-generi';            h = 'generi' },
  @{ n = '04-voti';              h = 'voti' },
  @{ n = '05-qualita';           h = 'qualita' },
  @{ n = '06-libreria';          h = 'libreria' },
  @{ n = '07-controllo-produzione'; h = 'controllo/produzione' },
  @{ n = '08-controllo-parametri';  h = 'controllo/parametri' },
  @{ n = '09-controllo-generi';     h = 'controllo/generi' },
  @{ n = '10-controllo-guida';      h = 'controllo/guida' },
  @{ n = '11-controllo-note';       h = 'controllo/note' },
  @{ n = '12-controllo-storico';    h = 'controllo/storico' },
  @{ n = '13-log';               h = 'log' },
  @{ n = '14-andamento';         h = 'andamento' }
)

$profilo = Join-Path $env:TEMP 'os-screenshot-profile'
# Chrome scrive avvisi sul registro di errore: non devono fermare lo script
$ErrorActionPreference = 'Continue'
foreach ($p in $pagine) {
  $file = Join-Path $cartella ($p.n + '.png')
  $url = 'http://127.0.0.1:5790/dashboard#' + $p.h
  $args = @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    "--user-data-dir=$profilo", '--window-size=1440,1000',
    '--virtual-time-budget=8000', "--screenshot=$file", $url
  )
  & $browser @args 2>$null | Out-Null
  if (-not (Test-Path $file)) { Write-Warning "screenshot non creato: $($p.n)" }
}
Write-Output "Screenshot aggiornati in $cartella"
