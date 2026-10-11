const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const probeRoot = path.join(root, 'artifacts', 'recheck-final', 'startup-fixture');
fs.mkdirSync(path.join(probeRoot, 'cases'), { recursive: true });
fs.writeFileSync(path.join(probeRoot, 'cases', 'case-corrupt.json'), '{invalid json');
const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "require('./services/api/src/index.ts')"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'test', DATA_DIR: probeRoot, ARTIFACTS_DIR: path.join(probeRoot, 'artifacts') },
  encoding: 'utf8', timeout: 30000,
});
const report = { scenario: 'API initialization with one corrupt case record', expectedExit: 0, actualExit: result.status, error: result.error?.message, stdout: result.stdout, stderr: result.stderr };
fs.writeFileSync(path.join(root, 'artifacts', 'recheck-final', 'startup-probe.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ expectedExit: 0, actualExit: result.status, corruptionDetected: result.stderr?.includes('CorruptCaseRecordError') }));
process.exitCode = result.status === 0 ? 0 : 1;
