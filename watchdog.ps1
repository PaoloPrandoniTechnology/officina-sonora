# Watchdog in background (nessuna finestra): tiene vivi gateway, n8n, LM Studio (gemma) e il motore YuE2.
# Avviato da avvia-automazione.vbs (finestra nascosta). Si ferma quando esiste il file state\STOP.
$ErrorActionPreference = 'SilentlyContinue'

# Variabili per n8n: vengono ereditate da tutti i processi avviati qui
$env:N8N_USER_FOLDER = 'E:\n8n\data'
$env:N8N_PORT = '5678'
$env:NODE_FUNCTION_ALLOW_BUILTIN = 'fs,path,http,https'
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'false'
$env:N8N_RUNNERS_TASK_TIMEOUT = '3600'
$env:N8N_CONCURRENCY_PRODUCTION_LIMIT = '1'
$env:N8N_LOG_OUTPUT = 'file'
$env:N8N_LOG_FILE_LOCATION = 'E:\n8n\yoga\state\n8n.log'
$env:EXECUTIONS_DATA_PRUNE = 'true'
$env:EXECUTIONS_DATA_MAX_AGE = '72'

$Root = 'E:\n8n'
$StateDir = 'E:\n8n\yoga\state'
$StopFlag = "$StateDir\STOP"
$StateFile = "$StateDir\state.json"
$WatchLog = "$StateDir\watchdog.log"
$GatewayDir = 'E:\n8n\yoga\gateway'
$SecretsDir = 'E:\n8n\yoga\secrets'
$Lms = "$env:USERPROFILE\.cache\lm-studio\bin\lms.exe"
$Studio = 'E:\MusicAI\YuE2 Studio'
$Models = "$Studio\data\models\yue2-cpp"
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Log($msg) { Add-Content -Path $WatchLog -Value ('{0} {1}' -f (Get-Date -Format 's'), $msg) }
# Battito di vita letto dal supervisore: se si ferma per troppo tempo, il watchdog viene riavviato
function Battito { Set-Content -Path "$StateDir\watchdog.heartbeat" -Value (Get-Date -Format 's') }

# Decifra un file DPAPI (leggibile solo dal tuo utente Windows)
function Leggi-Segreto($file) {
  if (-not (Test-Path $file)) { return '' }
  $sec = Get-Content $file | ConvertTo-SecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

# Gateway: l'unico processo che conosce i token. I token vanno solo nel suo ambiente,
# che viene ripulito subito dopo l'avvio: n8n non li eredita.
function Avvia-Gateway {
  $ok = $false
  try { Invoke-WebRequest -Uri 'http://127.0.0.1:5790/' -Method Post -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true } catch { $ok = ($null -ne $_.Exception.Response) }
  if ($ok) { return }
  $env:TELEGRAM_BOT_TOKEN = Leggi-Segreto "$SecretsDir\telegram.dpapi"
  $env:IBROADCAST_REFRESH = Leggi-Segreto "$SecretsDir\ibroadcast-refresh.dpapi"
  $env:IBROADCAST_CLIENT_ID = 'CLIENT_ID_IN_SECRETS'
  Start-Process -FilePath 'node' -ArgumentList "`"$GatewayDir\server.js`"" -WindowStyle Hidden -WorkingDirectory $GatewayDir
  Remove-Item Env:TELEGRAM_BOT_TOKEN, Env:IBROADCAST_REFRESH, Env:IBROADCAST_CLIENT_ID -ErrorAction SilentlyContinue
  Log 'gateway avviato'
}

# Lancia lms in una finestra nascosta e ritorna il suo output (evita console visibili)
function Invoke-Lms([string[]]$Arguments) {
  $out = [System.IO.Path]::GetTempFileName()
  $p = Start-Process -FilePath $Lms -ArgumentList $Arguments -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError "$out.err"
  # lms scrive alcuni messaggi (es. "No models are currently loaded") su stderr: li leggiamo entrambi
  $text = (Get-Content $out -Raw) + "`n" + (Get-Content "$out.err" -Raw)
  Remove-Item $out, "$out.err" -Force -ErrorAction SilentlyContinue
  return $text
}

# Un solo watchdog alla volta
$others = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*watchdog.ps1*' }
if ($others) { exit 0 }

function Up($url) {
  try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 | Out-Null; return $true } catch { return $false }
}

function HasJob {
  if (-not (Test-Path $StateFile)) { return $false }
  try { $s = Get-Content $StateFile -Raw | ConvertFrom-Json; return ($null -ne $s.job) } catch { return $false }
}

Log 'watchdog avviato'
while (-not (Test-Path $StopFlag)) {
  Battito
  Avvia-Gateway
  # n8n
  if (-not (Up 'http://127.0.0.1:5678/healthz')) {
    Log 'n8n non risponde: avvio'
    Start-Process -FilePath 'node' -ArgumentList "`"$Root\node_modules\n8n\bin\n8n`"", 'start' -WindowStyle Hidden -WorkingDirectory $Root
    Start-Sleep -Seconds 60
  }

  # LM Studio: server e modello gemma (gemma scaricato dalla GPU quando c'e' un render)
  if (-not (Up 'http://127.0.0.1:1234/v1/models')) {
    Log 'server LM Studio non attivo: avvio'
    Invoke-Lms @('server', 'start', '-p', '1234') | Out-Null
  }
  $ps = Invoke-Lms @('ps')
  if (HasJob) {
    if ($ps -match 'gemma') { Log 'render in corso: scarico gemma dalla GPU'; Invoke-Lms @('unload', '--all') | Out-Null }
  } elseif ($ps -notmatch 'gemma') {
    Log 'nessun render: carico gemma'
    Invoke-Lms @('load', 'google/gemma-4-e4b', '-y', '-c', '131072') | Out-Null
  }

  # Motore YuE2: riavvia solo se il processo non esiste (evita doppie istanze mentre lavora)
  if (-not (Up 'http://127.0.0.1:18087/health')) {
    if (-not (Get-Process yue-server -ErrorAction SilentlyContinue)) {
      Log 'motore YuE2 non attivo: avvio'
      $args2 = @('--model', "`"$Models\own\YuE2-3B-RS-TW-2.0x0.75-Q6_K.gguf`"", '--vae', "`"$Models\YuE2-Vae-F32.gguf`"",
        '--adapters', "`"$Studio\data\adapters`"", '--host', '127.0.0.1', '--port', '18087')
      Start-Process -FilePath "$Studio\resources\yue2-cpp\yue-server.exe" -ArgumentList $args2 -WindowStyle Hidden
    }
  }

  for ($i = 0; $i -lt 60 -and -not (Test-Path $StopFlag); $i++) { Start-Sleep -Seconds 1; if ($i % 10 -eq 0) { Battito } }
}
Log 'watchdog fermato'
