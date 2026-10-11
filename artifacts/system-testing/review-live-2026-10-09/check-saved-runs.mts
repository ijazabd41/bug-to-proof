import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { classifyReport } from '../../../services/api/src/runner/classification.ts';
const root = process.cwd();
const live = JSON.parse(fs.readFileSync('artifacts/system-testing/live-model-eval-2026-10-09/live-model-evaluation-results.json', 'utf8'));
const ids = new Set(live.results.filter((r: any) => r.verified).map((r: any) => r.proposal.proposalId));
const rows = [];
for (const dir of fs.readdirSync('artifacts/runs', {withFileTypes: true})) {
  if (!dir.isDirectory()) continue;
  const runRoot = path.join(root, 'artifacts/runs', dir.name);
  const recordPath = path.join(runRoot, 'run.json');
  if (!fs.existsSync(recordPath)) continue;
  const run = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  if (!ids.has(run.proposal?.proposalId)) continue;
  const phases = [];
  for (const [name, relative, saved] of [
    ['baseline', 'baseline', run.baselineRun],
    ['after', `attempt-${run.attempt}/verification`, run.postPatchRun],
  ] as const) {
    const raw = fs.readFileSync(path.join(runRoot, relative, 'result.json'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(runRoot, relative, 'manifest.json'), 'utf8'));
    const hash = createHash('sha256').update(raw).digest('hex');
    const classified = classifyReport(JSON.parse(raw), manifest.exitCode);
    phases.push({name, outcome: classified.outcome, hashMatches: hash === saved.reportHash && hash === manifest.reportHash,
      identitiesMatch: JSON.stringify(classified.testIds) === JSON.stringify(saved.testIds),
      fingerprintMatchesManifest: manifest.testFingerprint === saved.testFingerprint});
  }
  rows.push({caseId: run.caseId, runId: run.runId, phases,
    sameTests: run.baselineRun.testFingerprint === run.postPatchRun.testFingerprint && JSON.stringify(run.baselineRun.testIds) === JSON.stringify(run.postPatchRun.testIds),
    checks: run.requiredChecks.map((c: any) => ({type:c.type, passed:c.passed, exitCode:c.exitCode, logExists: !!c.artifactPath && fs.existsSync(path.join(root,c.artifactPath))}))});
}
const result = {scope:'Reinspection of saved execution evidence; no new model/browser/check execution',rows};
fs.writeFileSync('artifacts/system-testing/review-live-2026-10-09/saved-run-review.json', JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
