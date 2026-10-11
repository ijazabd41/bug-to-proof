import fs from 'node:fs';
import path from 'node:path';
import { validateVerificationGates } from '../../../services/api/src/ai/repair/verification.ts';
import { testFingerprint } from '../../../services/api/src/runner/integrity.ts';
import { classifyReport } from '../../../services/api/src/runner/classification.ts';

const spec = 'tests/playwright/cases/case-001-cart-total.spec.ts';
const fp = testFingerprint(spec);
const report = { suites: [{ specs: [{ file: spec, title: 'cart total should equal sum of all item prices', tests: [{ projectName: 'chromium', expectedStatus: 'passed', results: [{status: 'passed'}] }] }] }], stats: {expected: 1, unexpected: 0} };
const realFormatIds = classifyReport(report, 0).testIds;
const caseId = 'case-001';
const checks = ['typecheck','build','unit-tests'].map(type => ({checkId: type, name: type, type, command: 'SIMULATED', passed: true, exitCode: 0, durationMs: 0, output: 'SIMULATED'}));
const run = { runAt: new Date().toISOString(), durationMs: 0, expected: '30', actual: '10', evidenceIds: [], testFingerprint: fp, reportHash: 'no-report-exists-this-is-not-a-hash', runId: 'nonexistent-probe-run' };
function probe(ids: string[]) {
  return validateVerificationGates({caseId, reproductionTestFile: spec, testFingerprint: fp,
    baselineRun: {...run, testIds: ids, outcome: 'ASSERTION_FAILED', passed: false},
    postPatchRun: {...run, testIds: ids, outcome: 'PASSED', passed: true}, requiredChecks: checks as any});
}
const result = {
  scope: 'Simulated gate contract probe; no browser, model, real patch or regression execution',
  fabricatedCaseIdAndMissingReports: probe([caseId]),
  runnerFormatIdentities: realFormatIds,
  matchingRunnerFormatIdentities: probe(realFormatIds),
};
const root = path.resolve('artifacts/system-testing/review-followup-2026-10-09');
fs.writeFileSync(path.join(root, 'gate-probe-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
