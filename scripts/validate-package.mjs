import { cp, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { validatePackageDirectory } from '@zync-sh/plugin-sdk/validate';

const packageRoot = process.cwd();
const stagingDirectory = await mkdtemp(path.join(tmpdir(), 'zedit-package-'));

try {
  await Promise.all([
    copyFile(path.join(packageRoot, 'manifest.json'), path.join(stagingDirectory, 'manifest.json')),
    copyFile(path.join(packageRoot, 'editor.html'), path.join(stagingDirectory, 'editor.html')),
    cp(path.join(packageRoot, 'dist'), path.join(stagingDirectory, 'dist'), { recursive: true }),
  ]);

  const result = validatePackageDirectory(stagingDirectory);
  for (const issue of result.issues) {
    const output = issue.severity === 'error' ? console.error : console.warn;
    output(`[${issue.severity}] ${issue.path}: ${issue.message}`);
  }

  if (!result.valid) process.exitCode = 1;
  else console.log('[validate] Packaged Zedit files passed the Zync SDK preflight.');
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
