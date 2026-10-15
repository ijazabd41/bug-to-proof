$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$root = Join-Path $PSScriptRoot "live-acceptance-calculation-retry"
New-Item -ItemType Directory -Force -Path $root | Out-Null
$body = @{
  title = "Cart total omits the shipping charge after adding a keyboard"
  description = "The visible Shipping charge is not included in the displayed Total for a cart below the free-shipping threshold."
  steps = @("Open the shop page", "Add Keyboard to the cart", "Compare the displayed Shipping and Total values")
  expected = "For a $10.00 Keyboard plus $5.00 shipping, Total should be $15.00."
  actual = "The page displays $5.00 shipping but Total remains $10.00."
  startPath = "/"
  context = "Fresh browser storage and an initially empty cart."
}
$case = Invoke-RestMethod -Method Post -Uri "$api/cases" -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 8)
Start-Sleep -Seconds 12
$started = Invoke-RestMethod -Method Post -Uri "$api/cases/$($case.id)/reproduction-runs" -ContentType "application/json" -Body "{}"
$terminal = @("AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED")
$deadline = (Get-Date).AddMinutes(8)
do {
  Start-Sleep -Seconds 2
  $run = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$($started.reproductionRunId)"
  if ((Get-Date) -gt $deadline) { throw "Polling timed out for run $($started.reproductionRunId)" }
} while ($terminal -notcontains $run.state)
$directory = Join-Path $root "calculation-state-$($case.id)-$($run.reproductionRunId)"
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$case | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $directory "case.json") -Encoding utf8
$run | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $directory "run.json") -Encoding utf8
[ordered]@{
  category = "calculation-state"
  caseId = $case.id
  reproductionRunId = $run.reproductionRunId
  state = $run.state
  stopReason = $run.stopReason
  attemptExecutionIds = @($run.attempts | ForEach-Object { $_.attemptExecutionId })
  classifications = @($run.attempts | ForEach-Object { $_.classification })
  evidenceDirectory = $directory
} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root "submitted-run.json") -Encoding utf8
Write-Output "completed category=calculation-state caseId=$($case.id) runId=$($run.reproductionRunId) state=$($run.state) attempts=$($run.attempts.Count)"
