$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:3001/api"
$evidenceRoot = Join-Path $PSScriptRoot "trusted-target-runtime-live-acceptance"
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$reports = @(
  @{ slug = "calculation-state"; body = @{ title = "Cart total omits the shipping charge"; description = "When the cart subtotal is below the free-shipping threshold, the displayed Total shows only the merchandise subtotal instead of subtotal plus the visible shipping charge."; steps = @("Open the shop page", "Add Keyboard to the cart", "Observe the Shipping and Total values"); expected = 'With a $10.00 Keyboard and $5.00 shipping, Total should display $15.00.'; actual = 'Shipping displays $5.00 but Total displays $10.00.'; startPath = "/"; context = "Fresh browser storage and an initially empty cart." } },
  @{ slug = "cart-action"; body = @{ title = "Removing one unit deletes the entire cart line"; description = "When the same product has quantity two, clicking its Remove button deletes the whole line instead of removing one unit."; steps = @("Open the shop page", "Add Keyboard to the cart twice", "Click Remove for Keyboard once"); expected = "Keyboard should remain in the cart with quantity 1."; actual = "The Keyboard line disappears and the cart becomes empty."; startPath = "/"; context = "Fresh browser storage and an initially empty cart." } },
  @{ slug = "navigation"; body = @{ title = "Cart navigation does not open the dedicated cart route"; description = "After adding a product, activating the Cart navigation link appears to leave the user on the shop route instead of opening the dedicated cart page."; steps = @("Open the shop page", "Add USB Hub to the cart", "Activate the Cart navigation link"); expected = "The browser URL path should become /cart and the Cart page should be visible."; actual = "The browser appears to remain on / and still shows the shop product grid."; startPath = "/"; context = "Fresh browser storage and an initially empty cart." } }
)
$summaries = @()
$terminal = @("AWAITING_TEST_REVIEW", "CANDIDATE_INVALID", "CANDIDATE_EXECUTION_ERROR", "BASELINE_PASSED", "UNSUPPORTED", "CANCELLED", "BLOCKED", "REPRODUCED")
foreach ($report in $reports) {
  $created = Invoke-RestMethod -Method Post -Uri "$api/cases" -ContentType "application/json" -Body ($report.body | ConvertTo-Json -Depth 8)
  Start-Sleep -Seconds 12
  $started = Invoke-RestMethod -Method Post -Uri "$api/cases/$($created.id)/reproduction-runs" -ContentType "application/json" -Body "{}"
  $deadline = (Get-Date).AddMinutes(8)
  do {
    Start-Sleep -Seconds 2
    $run = Invoke-RestMethod -Method Get -Uri "$api/reproduction-runs/$($started.reproductionRunId)"
    if ((Get-Date) -gt $deadline) { throw "Polling timed out for run $($started.reproductionRunId)" }
  } while ($terminal -notcontains $run.state)
  $directory = Join-Path $evidenceRoot "$($report.slug)-$($created.id)-$($run.reproductionRunId)"
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $created | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $directory "case.json") -Encoding utf8
  $run | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $directory "run.json") -Encoding utf8
  $summary = [ordered]@{ category = $report.slug; caseId = $created.id; reproductionRunId = $run.reproductionRunId; state = $run.state; stopReason = $run.stopReason; attemptExecutionIds = @($run.attempts | ForEach-Object { $_.attemptExecutionId }); classifications = @($run.attempts | ForEach-Object { $_.classification }); responseShapes = @($run.attempts | ForEach-Object { $_.responseShape }); evidenceDirectory = $directory }
  $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory "summary.json") -Encoding utf8
  $summaries += $summary
  Write-Output ("completed category={0} caseId={1} runId={2} state={3} attempts={4}" -f $report.slug, $created.id, $run.reproductionRunId, $run.state, $run.attempts.Count)
}
$summaries | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot "submitted-runs.json") -Encoding utf8
