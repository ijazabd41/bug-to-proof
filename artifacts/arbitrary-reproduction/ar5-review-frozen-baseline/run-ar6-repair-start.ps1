$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$caseId = "case-1791917776888-hvza72c3"
$started = Invoke-RestMethod -Method Post -Uri "$api/ai/cases/$caseId/repair-runs" -ContentType "application/json" -Body (@{ maxAttempts = 3; timeoutMs = 300000 } | ConvertTo-Json)
$terminal = @("AWAITING_REVIEW", "BLOCKED", "CANCELLED", "VERIFIED", "VERIFICATION_FAILED", "REJECTED")
$deadline = (Get-Date).AddMinutes(8)
do {
  Start-Sleep -Seconds 2
  $run = Invoke-RestMethod -Method Get -Uri "$api/ai/repair-runs/$($started.runId)"
  if ((Get-Date) -gt $deadline) { throw "Repair polling timed out for $($started.runId)" }
} while ($terminal -notcontains $run.state)
$run | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath (Join-Path $PSScriptRoot "ar6-repair-start-result.json") -Encoding utf8
Write-Output ("runId={0} state={1} proposal={2} testRoot={3}" -f $run.runId, $run.state, $run.proposal.proposalId, $run.reproductionTestRoot)
