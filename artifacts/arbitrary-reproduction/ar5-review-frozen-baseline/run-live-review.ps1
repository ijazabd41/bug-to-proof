$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$runId = "8dca2a60-8416-40e4-a4e6-e7de42948cf4"
$before = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$runId"
$attempt = @($before.attempts | Where-Object { $_.classification -eq "ASSERTION_FAILED" })[-1]
if (-not $attempt.definitionHash -or -not $attempt.compiledTestHash) { throw "Reviewable hashes are missing" }
$body = @{ decision = "APPROVE"; definitionHash = $attempt.definitionHash; compiledTestHash = $attempt.compiledTestHash; acceptedBy = "AR5 live acceptance reviewer"; reviewerNotes = "The generated assertion directly maps the reported expected total to the discovered cart-total target." }
$reviewed = Invoke-RestMethod -Method Post -Uri "$api/reproduction-runs/$runId/review" -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10)
$case = Invoke-RestMethod -Method Get -Uri "$api/cases/$($reviewed.caseId)"
$output = @{ request = $body; run = $reviewed; case = $case }
$output | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $PSScriptRoot "live-review-result.json") -Encoding utf8
Write-Output ("runId={0} state={1} caseStatus={2} frozenTest={3}" -f $runId, $reviewed.state, $case.status, $reviewed.acceptedCandidate.frozenTestPath)
