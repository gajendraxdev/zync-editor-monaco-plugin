import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkReleaseTag } from './check-release-tag.mjs';

const PLUGIN_ID = 'com.zync.editor.zedit';
const KEY_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SIGNATURE_FILES = new Set(['integrity.json', 'signature.json']);

function payloadFiles(root) {
  const files = [];
  function visit(directory, relativeDirectory = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Package contains a symbolic link: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Package contains a non-file entry: ${relative}`);
    }
  }
  visit(root);
  return files.sort();
}

export function assertSignedPayloadMatches(candidate, signed) {
  const sourceFiles = payloadFiles(candidate);
  if (!sourceFiles.includes('manifest.json') || !sourceFiles.includes('editor.html') ||
      !sourceFiles.some((file) => file.startsWith('dist/'))) {
    throw new Error('Candidate is missing required Zedit package files');
  }
  if (sourceFiles.some((file) => SIGNATURE_FILES.has(file) ||
      !['manifest.json', 'editor.html'].includes(file) && !file.startsWith('dist/'))) {
    throw new Error('Candidate contains an unexpected file');
  }
  const signedFiles = payloadFiles(signed);
  if (![...SIGNATURE_FILES].every((file) => signedFiles.includes(file))) {
    throw new Error('Signed package is missing integrity or signature metadata');
  }
  const signedPayload = signedFiles.filter((file) => !SIGNATURE_FILES.has(file));
  if (sourceFiles.join('\n') !== signedPayload.join('\n')) {
    throw new Error('Signed payload file list differs from the tested candidate');
  }
  for (const file of sourceFiles) {
    if (!fs.readFileSync(path.join(candidate, file)).equals(fs.readFileSync(path.join(signed, file)))) {
      throw new Error(`Signed payload differs from the tested candidate: ${file}`);
    }
  }
}

function checkIdentity(tag, source) {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  checkReleaseTag(tag, manifest, packageJson);
  if (manifest.id !== PLUGIN_ID) throw new Error(`Unexpected plugin ID: ${manifest.id}`);
}

async function loadSigner(sdkRoot) {
  const signerPath = path.resolve(sdkRoot, 'packages/plugin-sdk/signing.js');
  return import(pathToFileURL(signerPath).href);
}

function checkKeyId(keyId) {
  if (!KEY_ID_PATTERN.test(keyId ?? '')) {
    throw new Error('Set ZEDIT_PUBLISHER_KEY_ID to the approved sha256 fingerprint');
  }
}

export async function signRelease({ tag, candidate, output, sdkRoot, privatePem, passphrase, expectedKeyId }) {
  checkKeyId(expectedKeyId);
  checkIdentity(tag, candidate);
  if (!privatePem?.trimStart().startsWith('-----BEGIN ')) {
    throw new Error('Missing ZEDIT_PUBLISHER_PRIVATE_KEY PEM secret');
  }
  const { signPluginDirectory, verifySignedPlugin } = await loadSigner(sdkRoot);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'zedit-release-signing-'));
  try {
    const keyPath = path.join(temporary, 'publisher-private.pem');
    fs.writeFileSync(keyPath, privatePem, { flag: 'wx', mode: 0o600 });
    signPluginDirectory(candidate, keyPath, output, Date.now(), { passphrase: passphrase || undefined });
    const verified = verifySignedPlugin(output);
    if (verified.pluginId !== PLUGIN_ID || verified.keyId !== expectedKeyId) {
      throw new Error('Signed package does not match the approved plugin identity and key');
    }
    assertSignedPayloadMatches(candidate, output);
    return verified;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export async function verifyRelease({ tag, signed, sdkRoot, expectedKeyId }) {
  checkKeyId(expectedKeyId);
  checkIdentity(tag, signed);
  const { verifySignedPlugin } = await loadSigner(sdkRoot);
  const verified = verifySignedPlugin(signed);
  if (verified.pluginId !== PLUGIN_ID || verified.keyId !== expectedKeyId) {
    throw new Error('Release archive does not match the approved plugin identity and key');
  }
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, tag, source, fourth, fifth] = process.argv.slice(2);
  const privatePem = process.env.ZEDIT_PUBLISHER_PRIVATE_KEY;
  const passphrase = process.env.ZEDIT_PUBLISHER_KEY_PASSPHRASE;
  delete process.env.ZEDIT_PUBLISHER_PRIVATE_KEY;
  delete process.env.ZEDIT_PUBLISHER_KEY_PASSPHRASE;
  try {
    const expectedKeyId = process.env.ZEDIT_PUBLISHER_KEY_ID;
    let verified;
    if (command === 'sign' && tag && source && fourth && fifth) {
      verified = await signRelease({
        tag, candidate: source, output: fourth, sdkRoot: fifth,
        privatePem, passphrase, expectedKeyId,
      });
    } else if (command === 'verify' && tag && source && fourth && !fifth) {
      verified = await verifyRelease({ tag, signed: source, sdkRoot: fourth, expectedKeyId });
    } else {
      throw new Error('Usage: sign <tag> <candidate> <output> <sdk-root> | verify <tag> <signed> <sdk-root>');
    }
    console.log(`Verified ${verified.pluginId} with publisher key ${verified.keyId}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
