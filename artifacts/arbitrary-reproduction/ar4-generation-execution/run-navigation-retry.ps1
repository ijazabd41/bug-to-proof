$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$evidenceRoot = Join-Path $PSScriptRoot "trusted-target-runtime-retries"
$category = "navigation"
$caseId = "case-1791917827903-dh7fk4p5"
$terminal = @("AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED")
$case = Invoke-RestMethod -Method Get -Uri "$api/cases/$caseId"
$started = Invoke-RestMethod -Method Post -Uri "$api/cases/$caseId/reproduction-runs" -ContentType "application/json" -Body "{}"
$deadline = (Get-Date).AddMinutes(8)
do {
  Start-Sleep -Seconds 2
  $run = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$($started.reproductionRunId)"
  if ((Get-Date) -gt $deadline) { throw "Polling timed out for run $($started.reproductionRunId)" }
} while ($terminal -notcontains $run.state)
$directory = Join-Path $evidenceRoot "$category-$caseId-$($run.reproductionRunId)"
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$case | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $directory "case.json") -Encoding utf8
$run | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $directory "run.json") -Encoding utf8
[ordered]@{ category = $category; caseId = $caseId; reproductionRunId = $run.reproductionRunId; state = $run.state; stopReason = $run.stopReason; classifications = @($run.attempts | ForEach-Object { $_.classification }); evidenceDirectory = $directory } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory "summary.json") -Encoding utf8
Write-Output ("completed category={0} runId={1} state={2} attempts={3}" -f $category, $run.reproductionRunId, $run.state, $run.attempts.Count)
