# Chiavi dei servizi di testo in cloud: le chiede a video, le salva cifrate (DPAPI, leggibili solo dal tuo
# utente Windows) in secrets\ e prova i servizi. Invio a vuoto = lascia com'e'.
# Uso: powershell -ExecutionPolicy Bypass -File tools\chiavi.ps1
$radice = Split-Path $PSScriptRoot -Parent
$segreti = Join-Path $radice 'secrets'
New-Item -ItemType Directory -Force -Path $segreti | Out-Null

$pagine = [ordered]@{
  gemini     = 'https://aistudio.google.com/apikey'
  groq       = 'https://console.groq.com/keys'
  openrouter = 'https://openrouter.ai/keys'
}
foreach ($nome in $pagine.Keys) {
  $file = Join-Path $segreti "$nome.dpapi"
  $stato = if (Test-Path $file) { 'gia'' inserita' } else { 'mancante' }
  Write-Host "`n$nome ($stato) - si crea su $($pagine[$nome])"
  $chiave = Read-Host -AsSecureString 'Incolla la chiave (Invio per saltare)'
  if ($chiave.Length -gt 0) {
    $chiave | ConvertFrom-SecureString | Set-Content -Path $file -Encoding ascii
    Write-Host 'Salvata.'
  }
}

Write-Host "`nProva dei servizi con chiave:"
$servizi = (Get-Content (Join-Path $radice 'config\servizi.json') -Raw | ConvertFrom-Json).testi
foreach ($s in $servizi) {
  if (-not (Test-Path (Join-Path $segreti "$($s.chiave).dpapi"))) { continue }
  $corpo = @{ system = 'Rispondi solo con JSON valido.'; user = 'Rispondi con {"ok":true}'; maxTokens = 50; solo = $s.nome } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri 'http://127.0.0.1:5790/llm/chat' -Method Post -Body $corpo -ContentType 'application/json' -TimeoutSec 90
    if ($r.ok) { Write-Host "  $($s.nome): funziona" } else { Write-Host "  $($s.nome): $($r.error)" }
  } catch { Write-Host "  $($s.nome): il gateway non risponde (avvia l'automazione)" }
}
