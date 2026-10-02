$ErrorActionPreference = 'Stop'
$runningFile = Join-Path $PSScriptRoot '.runtime/running.json'
if (-not (Test-Path -LiteralPath $runningFile)) { Write-Output '没有这份备用入口的启动记录。'; exit 0 }
$running = Get-Content -LiteralPath $runningFile -Raw | ConvertFrom-Json
foreach ($entry in @(@{id=$running.tunnelPid;started=$running.tunnelStarted},@{id=$running.gatewayPid;started=$running.gatewayStarted})) {
  $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
  if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) { Stop-Process -Id $process.Id }
}
Write-Output '已停止本次临时入口。原游戏网址不受影响。'
