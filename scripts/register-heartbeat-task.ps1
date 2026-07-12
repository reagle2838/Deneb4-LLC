<#
.SYNOPSIS
  Register (or remove) a Windows Scheduled Task that fires the Deneb4 agent
  heartbeat on an interval. This is the ROADMAP "point a scheduler at the
  heartbeat" step for a local/Windows deployment.

.DESCRIPTION
  Creates a task named "Deneb4 Agent Heartbeat" that runs
  scripts/heartbeat-trigger.mjs every N minutes. The trigger is resilient:
  when the app is offline it logs and exits cleanly, so an idle machine
  doesn't accumulate failures.

  Run this yourself when you're ready to stop clicking "Run heartbeat now" —
  registering a scheduled task is a system change, so it's deliberately not
  automated. Requires the dev server (or a deployed app) to be reachable at
  -Url for ticks to do anything.

.PARAMETER IntervalMinutes
  How often to fire. Default 30. Every 15-60 min is sensible; the duties are
  idempotent and per-item deduped, so a frequent interval is safe.

.PARAMETER Url
  The app origin to hit. Default http://localhost:3005.

.PARAMETER LogPath
  Where trigger output is appended. Default: <repo>\builds\.heartbeat.log

.PARAMETER Remove
  Unregister the task instead of creating it.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-heartbeat-task.ps1 -IntervalMinutes 30
  powershell -ExecutionPolicy Bypass -File scripts\register-heartbeat-task.ps1 -Remove
#>

param(
  [int]$IntervalMinutes = 30,
  [string]$Url = "http://localhost:3005",
  [string]$LogPath = "",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$TaskName = "Deneb4 Agent Heartbeat"

if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "No task named '$TaskName' is registered."
  }
  return
}

# Resolve repo root (this script lives in <repo>\scripts).
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Trigger = Join-Path $RepoRoot "scripts\heartbeat-trigger.mjs"
if (-not (Test-Path $Trigger)) { throw "Cannot find $Trigger" }
if ($LogPath -eq "") { $LogPath = Join-Path $RepoRoot "builds\.heartbeat.log" }

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { throw "node is not on PATH; install Node or run from a shell where it is." }

# The action: node heartbeat-trigger.mjs --url <url>, appending to the log.
# Wrapped in cmd so we can redirect output to the log file.
$Cmd = "`"$Node`" `"$Trigger`" --url $Url >> `"$LogPath`" 2>&1"
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $Cmd" -WorkingDirectory $RepoRoot

# Repeat every N minutes, indefinitely, starting a minute from now.
$Start = (Get-Date).AddMinutes(1)
$Trig = New-ScheduledTaskTrigger -Once -At $Start `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew

# Runs as the current user, only when logged on (no stored password needed).
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Replaced the existing task."
}
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trig `
  -Settings $Settings -Description "Fires the Deneb4 agent heartbeat every $IntervalMinutes minutes." | Out-Null

Write-Host "Registered '$TaskName': every $IntervalMinutes min against $Url."
Write-Host "  Log:    $LogPath"
Write-Host "  Test:   Start-ScheduledTask -TaskName '$TaskName'  (then check the log)"
Write-Host "  Remove: powershell -ExecutionPolicy Bypass -File scripts\register-heartbeat-task.ps1 -Remove"
