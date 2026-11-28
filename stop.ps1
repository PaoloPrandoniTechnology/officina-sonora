# Ferma tutta l'automazione: watchdog, n8n (porta 5678), motore YuE2 e le eventuali finestre cmd residue.
# LM Studio resta acceso.
$ErrorActionPreference = 'SilentlyContinue'
New-Item -ItemType File -Force -Path 'E:\n8n\officina-sonora\state\STOP' | Out-Null

# Finestre cmd/powershell rimaste da avvii precedenti
Get-CimInstance Win32_Process -Filter "Name='cmd.exe' OR Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'watchdog\.ps1|node_modules\\n8n\\bin\\n8n' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

foreach ($port in 5678, 18087, 5790) {
  Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force
  }
}
Get-Process yue-server -ErrorAction SilentlyContinue | Stop-Process -Force
# Il file STOP resta: finché c'è, il supervisore non riavvia nulla. Lo cancella avvia-automazione.vbs.
