// New archive-integrity test; not a recovered gameplay regression suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSnapshot } from '../tools/check.mjs';
test('recovered source, runtime imports, PBR checksums, and authored JS syntax', () => {
  const result = auditSnapshot();
  assert.equal(result.status, 'passed');
  assert.equal(result.recoveryFilesPresent, 47);
  assert.equal(result.verifiedPBRAssets, 16);
  assert.ok(result.reachableBrowserModules > 40);
});
