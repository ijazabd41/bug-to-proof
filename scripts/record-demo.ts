import fs from "fs";
import path from "path";
import { runTest } from "../services/api/src/runner/playwrightRunner";
import { WORKSPACE_ROOT } from "../services/api/src/utils/paths";
async function main() {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") throw new Error("Use before or after");
  const result = await runTest("portfolio-cart", "tests/playwright/cases/case-001-cart-total.spec.ts", phase);
  fs.writeFileSync(path.join(WORKSPACE_ROOT, `artifacts/portfolio-cart-${phase}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ outcome: result.outcome, actual: result.actual, fingerprint: result.testFingerprint, artifacts: result.artifactPaths }, null, 2));
  process.exitCode = result.outcome === (phase === "before" ? "ASSERTION_FAILED" : "PASSED") ? 0 : 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
