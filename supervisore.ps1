# Supervisore del watchdog. Eseguito ogni 5 minuti dall'attivita' pianificata "OfficinaSonoraSupervisor".
# Riavvia il watchdog solo se e' morto o se il suo battito (state\watchdog.heartbeat) e' fermo da troppo tempo.
# Non fa nulla se l'automazione e' stata fermata a mano (file state\STOP).
$ErrorActionPreference = 'SilentlyContinue'
$StateDir = 'E:\n8n\officina-sonora\state'
$Log = "$StateDir\supervisore.log"
$Heartbeat = "$StateDir\watchdog.heartbeat"
$MaxMinuti = 15
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Log($msg) { Add-Content -Path $Log -Value ('{0} {1}' -f (Get-Date -Format 's'), $msg) }

if (Test-Path "$StateDir\STOP") { exit 0 }

$wd = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*watchdog.ps1*' })
$eta = 9999
if (Test-Path $Heartbeat) { $eta = ((Get-Date) - (Get-Item $Heartbeat).LastWriteTime).TotalMinutes }

if ($wd.Count -gt 0 -and $eta -lt $MaxMinuti) { exit 0 }

if ($wd.Count -gt 0) {
  $wd | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Log ('watchdog fermo da {0:N0} min (battito assente): riavvio' -f $eta)
} else {
  Log 'watchdog non attivo: avvio'
}
Start-Process -FilePath 'wscript.exe' -ArgumentList '"E:\n8n\avvia-automazione.vbs"' -WindowStyle Hidden
