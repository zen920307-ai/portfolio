$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = "C:\Program Files\nodejs\node.exe"
$vitePath = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
$runnerPath = Join-Path $PSScriptRoot "run-portfolio-server.vbs"
$taskName = "Tang Portfolio Local Site"

if (-not (Test-Path -LiteralPath $nodePath)) {
  throw "Node.js was not found at $nodePath"
}

if (-not (Test-Path -LiteralPath $vitePath)) {
  throw "Vite was not found. Install the project dependencies first."
}

if (-not (Test-Path -LiteralPath $runnerPath)) {
  throw "The hidden server runner was not found at $runnerPath"
}

$action = New-ScheduledTaskAction `
  -Execute "C:\Windows\System32\wscript.exe" `
  -Argument ('"' + $runnerPath + '"') `
  -WorkingDirectory $projectRoot

$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Runs Tang Qidong's local portfolio site without a console window." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
