$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$caseId = "case-1791834872639-wdq7dsy2"
$root = Join-Path $PSScriptRoot "live-acceptance-calculation-provider-retry"
New-Item -ItemType Directory -Force -Path $root | Out-Null
Start-Sleep -Seconds 30
$started = Invoke-RestMethod -Method Post -Uri "$api/cases/$caseId/reproduction-runs" -ContentType "application/json" -Body "{}"
$terminal = @("AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED")
$deadline = (Get-Date).AddMinutes(8)
do {
  Start-Sleep -Seconds 2
  $run = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$($started.reproductionRunId)"
  if ((Get-Date) -gt $deadline) { throw "Polling timed out for run $($started.reproductionRunId)" }
} while ($terminal -notcontains $run.state)
$directory = Join-Path $root "calculation-state-$caseId-$($run.reproductionRunId)"
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$run | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $directory "run.json") -Encoding utf8
[ordered]@{
  category = "calculation-state"
  caseId = $caseId
  reproductionRunId = $run.reproductionRunId
  state = $run.state
  stopReason = $run.stopReason
  attemptExecutionIds = @($run.attempts | ForEach-Object { $_.attemptExecutionId })
  classifications = @($run.attempts | ForEach-Object { $_.classification })
  evidenceDirectory = $directory
} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root "submitted-run.json") -Encoding utf8
Write-Output "completed category=calculation-state caseId=$caseId runId=$($run.reproductionRunId) state=$($run.state) attempts=$($run.attempts.Count)"
