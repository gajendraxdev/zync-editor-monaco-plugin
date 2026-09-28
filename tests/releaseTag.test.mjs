import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReleaseTag } from '../scripts/check-release-tag.mjs';

const manifest = { version: '0.1.0' };
const packageJson = { version: '0.1.0' };

test('accepts only the Zedit tag matching both package versions', () => {
  assert.doesNotThrow(() => checkReleaseTag('zedit-v0.1.0', manifest, packageJson));
  assert.throws(() => checkReleaseTag('v0.1.0', manifest, packageJson), /must be zedit-v0\.1\.0/);
  assert.throws(() => checkReleaseTag('zedit-v0.2.0', manifest, packageJson), /must be zedit-v0\.1\.0/);
  assert.throws(() => checkReleaseTag('zedit-v0.1.0', manifest, { version: '0.2.0' }), /do not match/);
});
