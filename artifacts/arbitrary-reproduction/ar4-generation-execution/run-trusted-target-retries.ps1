$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$evidenceRoot = Join-Path $PSScriptRoot "trusted-target-runtime-retries"
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

$calculationId = "case-1791917776888-hvza72c3"
$correctReport = @{
  schemaVersion = "1.0"
  steps = @("Open the shop page", "Add Keyboard to the cart", "Observe the Shipping and Total values")
  expected = 'With a $10.00 Keyboard and $5.00 shipping, Total should display $15.00.'
  actual = 'Shipping displays $5.00 but Total displays $10.00.'
  startPath = "/"
  context = "Fresh browser storage and an initially empty cart."
}
Invoke-RestMethod -Method Patch -Uri "$api/cases/$calculationId" -ContentType "application/json" -Body (@{ report = $correctReport } | ConvertTo-Json -Depth 10) | Out-Null

$reports = @(
  @{ category = "calculation-state"; caseId = $calculationId },
  @{ category = "cart-action"; caseId = "case-1791917801583-urha9nkd" },
  @{ category = "navigation"; caseId = "case-1791917827903-dh7fk4p5" }
)
$terminal = @("AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED")
$summaries = @()
foreach ($report in $reports) {
  $case = Invoke-RestMethod -Method Get -Uri "$api/cases/$($report.caseId)"
  $started = Invoke-RestMethod -Method Post -Uri "$api/cases/$($report.caseId)/reproduction-runs" -ContentType "application/json" -Body "{}"
  $deadline = (Get-Date).AddMinutes(8)
  do {
    Start-Sleep -Seconds 2
    $run = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$($started.reproductionRunId)"
    if ((Get-Date) -gt $deadline) { throw "Polling timed out for run $($started.reproductionRunId)" }
  } while ($terminal -notcontains $run.state)
  $directory = Join-Path $evidenceRoot "$($report.category)-$($report.caseId)-$($run.reproductionRunId)"
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $case | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $directory "case.json") -Encoding utf8
  $run | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $directory "run.json") -Encoding utf8
  $summary = [ordered]@{ category = $report.category; caseId = $report.caseId; reproductionRunId = $run.reproductionRunId; state = $run.state; stopReason = $run.stopReason; classifications = @($run.attempts | ForEach-Object { $_.classification }); evidenceDirectory = $directory }
  $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory "summary.json") -Encoding utf8
  $summaries += $summary
  Write-Output ("completed category={0} runId={1} state={2} attempts={3}" -f $report.category, $run.reproductionRunId, $run.state, $run.attempts.Count)
  Start-Sleep -Seconds 30
}
$summaries | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot "submitted-runs.json") -Encoding utf8
