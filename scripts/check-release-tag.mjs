import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function checkReleaseTag(tag, manifest, packageJson) {
  if (manifest.version !== packageJson.version) {
    throw new Error('manifest.json and package.json versions do not match');
  }
  const expected = `zedit-v${manifest.version}`;
  if (tag !== expected) {
    throw new Error(`Release tag must be ${expected}; received ${tag || '(none)'}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    checkReleaseTag(process.argv[2], manifest, packageJson);
    console.log(`Release tag matches Zedit ${manifest.version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
