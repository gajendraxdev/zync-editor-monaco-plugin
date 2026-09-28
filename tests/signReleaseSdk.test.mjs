import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { signRelease, verifyRelease } from '../scripts/sign-release.mjs';

test('pinned SDK signs and verifies a Zedit candidate', {
  skip: !process.env.ZEDIT_SDK_SOURCE_ROOT,
}, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'zedit-sdk-signing-test-'));
  try {
    const candidate = path.join(root, 'candidate');
    const signed = path.join(root, 'signed');
    mkdirSync(path.join(candidate, 'dist'), { recursive: true });
    writeFileSync(path.join(candidate, 'manifest.json'), JSON.stringify({
      manifestVersion: 2,
      id: 'com.zync.editor.zedit',
      publisher: 'com.zync',
      version: '0.1.0',
    }));
    writeFileSync(path.join(candidate, 'editor.html'), '<p>fixture</p>');
    writeFileSync(path.join(candidate, 'dist/editor.js'), '/* fixture */');

    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicBytes = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
    const expectedKeyId = `sha256:${createHash('sha256').update(publicBytes).digest('hex')}`;
    const sdkRoot = process.env.ZEDIT_SDK_SOURCE_ROOT;
    const tag = 'zedit-v0.1.0';
    const result = await signRelease({
      tag, candidate, output: signed, sdkRoot,
      privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      expectedKeyId,
    });
    assert.equal(result.keyId, expectedKeyId);
    assert.equal((await verifyRelease({ tag, signed, sdkRoot, expectedKeyId })).pluginId,
      'com.zync.editor.zedit');

    writeFileSync(path.join(signed, 'dist/editor.js'), 'tampered');
    await assert.rejects(verifyRelease({ tag, signed, sdkRoot, expectedKeyId }), /integrity/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
