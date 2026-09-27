# Bug-to-Proof — Demo Script (2–3 min)

> **Audience:** judges / technical reviewers  
> **Goal:** show the full loop from raw bug report to machine-verified fix in one live session  
> **Prereqs (already running):** MiniShop on `http://localhost:5174`, API on `http://localhost:3001`, Dashboard on `http://localhost:5173`

---

## 0 · Reset to clean demo state (15 s)

Open a terminal and run:

```bash
curl -s -X POST http://localhost:3001/api/demo/reset | jq .status
# expected: "REPRODUCED"
```

> This restores `case-001` to the seeded `REPRODUCED` state with the buggy code and a pre-recorded failing test run already attached.

---

## 1 · Show the bug live (30 s)

Open **http://localhost:5174** in a browser.

1. Click **Add to Cart** on **Keyboard ($10.00)**.
2. Click **Add to Cart** on **Mouse Pad ($20.00)**.
3. Point at the cart sidebar — **Total shows `$10.00`** instead of `$30.00`.

> The bug: `cartStore.total()` reads `items[0].price` and ignores every other item.

---

## 2 · Inspect the reproduced evidence (20 s)

```bash
curl -s http://localhost:3001/api/cases/case-001 | jq '{status, rootCauseExplanation}'
```

Show in the dashboard:
- Status badge: **REPRODUCED**
- Root-cause paragraph (LLM-generated)
- Before-phase screenshot at `http://localhost:3001/artifacts/case-001/before/screenshot.png` showing `$10.00`

---

## 3 · Propose and apply the patch (20 s)

Advance the case through the state machine:

```bash
# REPRODUCED → PATCH_PROPOSED
curl -s -X PATCH http://localhost:3001/api/cases/case-001 \
  -H 'Content-Type: application/json' \
  -d '{"status":"PATCH_PROPOSED"}' | jq .status

# PATCH_PROPOSED → PATCH_APPLIED
curl -s -X PATCH http://localhost:3001/api/cases/case-001 \
  -H 'Content-Type: application/json' \
  -d '{"status":"PATCH_APPLIED","patch":{"status":"APPLIED","appliedAt":"'"$(date -u +%FT%TZ)"'"}}' \
  | jq '{status, "patch.status": .patch.status}'
```

Point at the diff in the dashboard — one line changed:

```diff
- total: () => get().items[0]?.price ?? 0,
+ total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
```

---

## 4 · Trigger verification and watch it pass (30 s)

```bash
curl -s -X POST http://localhost:3001/api/cases/case-001/verify | jq .message
# "Verification started"
```

Poll until done (≈5 s):

```bash
watch -n2 'curl -s http://localhost:3001/api/cases/case-001 | jq "{status, verified: .verification.status}"'
```

Expected final output:

```json
{
  "status": "VERIFIED",
  "verified": "VERIFIED"
}
```

Refresh the browser at **http://localhost:5174** — cart now shows **`$30.00`**.

---

## 5 · Show the after evidence (15 s)

```bash
curl -s http://localhost:3001/api/cases/case-001 | jq '
  .verification | {
    beforeStatus: .comparison.beforeStatus,
    afterStatus:  .comparison.afterStatus,
    changed:      .comparison.statusChanged
  }'
```

Expected:
```json
{
  "beforeStatus": "FAILED",
  "afterStatus":  "PASSED",
  "changed":      true
}
```

Open after-phase screenshot at `http://localhost:3001/artifacts/case-001/after/screenshot.png` — shows **`$30.00`**.

---

## Summary

| Step | State | Evidence |
|------|-------|----------|
| Bug reported | `REPRODUCED` | before screenshot · trace · result.json |
| Patch proposed | `PATCH_PROPOSED` | unified diff in case JSON |
| Patch applied | `PATCH_APPLIED` | `appliedAt` timestamp recorded |
| Verification run | `VERIFIED` | after screenshot · 2/2 Playwright tests pass |
| Comparison | `FAILED → PASSED` | `statusChanged: true` |

**One 1-line fix. Two automated tests. Machine-verified before and after. No manual assertions weakened.**

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API returns 409 on `/verify` | Case is not in `PATCH_APPLIED` — re-run the reset + steps 3 |
| MiniShop shows stale total | Hard-refresh the browser (Ctrl+Shift+R) |
| Playwright times out | Ensure MiniShop is running: `curl http://localhost:5174` |
| API crashes mid-run | Restart: `node node_modules/tsx/dist/cli.mjs services/api/src/index.ts` |
