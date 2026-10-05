param([ValidateSet('render','original')][string]$Upstream = 'render')
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$runtimeDir = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$tunnelBinary = Join-Path $runtimeDir 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelBinary)) { throw '请先下载 Cloudflare 官方 cloudflared.exe 到 .runtime 文件夹。' }
$runningFile = Join-Path $runtimeDir 'running.json'
function Start-QiqueGateway {
  $nodeBinary = (Get-Command node).Source
  $previousUpstream = [Environment]::GetEnvironmentVariable('QIQUE_UPSTREAM','Process')
  try {
    $env:QIQUE_UPSTREAM = $Upstream
    $gateway = Start-Process -FilePath $nodeBinary -ArgumentList 'server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'gateway.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'gateway.stderr.log')
  } finally { [Environment]::SetEnvironmentVariable('QIQUE_UPSTREAM',$previousUpstream,'Process') }
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $gateway.Refresh()
    if ($gateway.HasExited) { throw '本地备用入口未启动，请检查 .runtime/gateway.stderr.log。' }
    try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/healthz' -TimeoutSec 2; if ($health.service -eq 'qique-backup-entry') { return $gateway } } catch {}
    Start-Sleep -Milliseconds 250
  }
  $gateway.Kill()
  throw '备用入口启动超时。'
}
if (Test-Path -LiteralPath $runningFile) {
  $running = Get-Content -LiteralPath $runningFile -Raw | ConvertFrom-Json
  $active = Get-Process -Id $running.tunnelPid -ErrorAction SilentlyContinue
  $activeGateway = Get-Process -Id $running.gatewayPid -ErrorAction SilentlyContinue
  if ($active -and $activeGateway -and $active.StartTime.ToUniversalTime().Ticks -eq ([datetime]$running.tunnelStarted).ToUniversalTime().Ticks -and $activeGateway.StartTime.ToUniversalTime().Ticks -eq ([datetime]$running.gatewayStarted).ToUniversalTime().Ticks) {
    $currentUpstream = if ($running.upstream) { $running.upstream } else { 'original' }
    if ($currentUpstream -ne $Upstream) {
      # Replace only the verified gateway. Keep the tested tunnel and its URL.
      $activeGateway.Kill()
      $null = $activeGateway.WaitForExit(5000)
      $replacement = Start-QiqueGateway
      $running.gatewayPid = $replacement.Id
      $running.gatewayStarted = $replacement.StartTime.ToUniversalTime().ToString('o')
      $running | Add-Member -NotePropertyName upstream -NotePropertyValue $Upstream -Force
      $running | ConvertTo-Json | Set-Content -LiteralPath $runningFile
    }
    Write-Output $running.url
    exit 0
  }
}
$gateway = Start-QiqueGateway
$tunnelLog = Join-Path $runtimeDir 'tunnel.stderr.log'
$tunnel = Start-Process -FilePath $tunnelBinary -ArgumentList @('tunnel','--url','http://127.0.0.1:8080','--protocol','http2','--no-autoupdate') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'tunnel.stdout.log') -RedirectStandardError $tunnelLog
$url = $null
for ($attempt = 0; $attempt -lt 50; $attempt++) {
  if ($tunnel.HasExited) { $gateway.Kill(); throw '临时入口未建立，请检查 .runtime/tunnel.stderr.log。' }
  if (Test-Path -LiteralPath $tunnelLog) { $logText = [string](Get-Content -LiteralPath $tunnelLog -Raw); $match = [regex]::Match($logText,'https://[a-z0-9-]+\.trycloudflare\.com'); if ($match.Success) { $url = $match.Value; break } }
  Start-Sleep -Milliseconds 500
}
if (-not $url) { $tunnel.Kill(); $gateway.Kill(); throw '临时网址生成超时。' }
@{url=$url;upstream=$Upstream;gatewayPid=$gateway.Id;gatewayStarted=$gateway.StartTime.ToUniversalTime().ToString('o');tunnelPid=$tunnel.Id;tunnelStarted=$tunnel.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $runningFile
Write-Output $url
Write-Output '临时测试入口已启动。电脑关机或停止程序后，链接会失效。'
