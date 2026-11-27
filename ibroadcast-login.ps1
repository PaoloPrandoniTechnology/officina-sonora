# Completa il login iBroadcast (Device Code Flow) e salva il refresh token cifrato con DPAPI.
# Uso: powershell -File ibroadcast-login.ps1 -DeviceCode <device_code> -Interval 1 -ExpiresIn 179
param([string]$DeviceCode, [int]$Interval = 1, [int]$ExpiresIn = 179)
$ErrorActionPreference = 'Stop'
# L'identificativo del client sta in secrets\ibroadcast-client.txt (non nel repository)
$client = (Get-Content 'E:\n8n\yoga\secrets\ibroadcast-client.txt' -Raw).Trim()
$out = 'E:\n8n\yoga\secrets\ibroadcast-refresh.dpapi'
$log = 'E:\n8n\yoga\state\ibroadcast-login.log'
New-Item -ItemType Directory -Force -Path 'E:\n8n\yoga\secrets' | Out-Null
function Log($m) { Add-Content $log ('{0} {1}' -f (Get-Date -Format s), $m) }

$deadline = (Get-Date).AddSeconds($ExpiresIn)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds $Interval
  try {
    $t = Invoke-RestMethod -Method Post -Uri 'https://oauth.ibroadcast.com/token' -Body @{
      grant_type = 'device_code'; client_id = $client; device_code = $DeviceCode
    } -ErrorAction Stop
    $t.refresh_token | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Path $out -Encoding ascii
    Log "login riuscito: scope $($t.scope)"
    exit 0
  } catch {
    $err = $null
    try { $err = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch {}
    if ($err -eq 'authorization_pending') { continue }
    if ($err -eq 'slow_down') { $Interval += 5; continue }
    Log "login fallito: $err $($_.Exception.Message)"
    exit 1
  }
}
Log 'login scaduto: codice non autorizzato in tempo'
exit 1
