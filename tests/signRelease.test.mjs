import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { assertSignedPayloadMatches } from '../scripts/sign-release.mjs';

test('signed payload must match the tested candidate exactly', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'zedit-release-test-'));
  try {
    const candidate = path.join(root, 'candidate');
    const signed = path.join(root, 'signed');
    mkdirSync(path.join(candidate, 'dist'), { recursive: true });
    mkdirSync(path.join(signed, 'dist'), { recursive: true });
    for (const file of ['manifest.json', 'editor.html', 'dist/editor.js']) {
      writeFileSync(path.join(candidate, file), file);
      writeFileSync(path.join(signed, file), file);
    }
    writeFileSync(path.join(signed, 'integrity.json'), '{}');
    writeFileSync(path.join(signed, 'signature.json'), '{}');
    assert.doesNotThrow(() => assertSignedPayloadMatches(candidate, signed));
    writeFileSync(path.join(signed, 'dist/editor.js'), 'changed');
    assert.throws(() => assertSignedPayloadMatches(candidate, signed), /differs/);
    writeFileSync(path.join(signed, 'dist/editor.js'), 'dist/editor.js');
    writeFileSync(path.join(candidate, 'unexpected.txt'), 'extra');
    assert.throws(() => assertSignedPayloadMatches(candidate, signed), /unexpected file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
