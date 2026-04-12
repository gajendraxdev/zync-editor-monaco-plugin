import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();

const distRoot = path.join(root, 'dist', 'context-engine');

const ensureDir = async (p) => mkdir(p, { recursive: true });

const configPath = path.join(root, 'scripts', 'context-engine.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const providers = Array.isArray(config.providers) ? config.providers : [];
const languages = Array.isArray(config.languages) ? config.languages : [];

const require = createRequire(import.meta.url);
let packageRoot = null;
try {
  // @enjoys/context-engine uses "exports" and does not export package.json.
  // Resolve the main entrypoint and treat its directory as the package root.
  const entryPath = require.resolve('@enjoys/context-engine');
  packageRoot = path.dirname(entryPath);
} catch {
  throw new Error(
    'Missing @enjoys/context-engine. Run `npm install` in zync-editor-monaco-plugin first.'
  );
}

const dataRootCandidates = [
  path.join(packageRoot, 'data'),
  path.join(packageRoot, 'dist', 'data'),
];

let dataRoot = null;
for (const candidate of dataRootCandidates) {
  try {
    // eslint-disable-next-line no-await-in-loop
    await readFile(path.join(candidate, 'manifest.json'), 'utf8');
    dataRoot = candidate;
    break;
  } catch {
    // continue
  }
}

if (!dataRoot) {
  throw new Error(`Could not locate context-engine data/manifest.json under ${packageRoot}`);
}

const writePack = async ({ provider, language, jsonText }) => {
  const outDir = path.join(distRoot, provider);
  await ensureDir(outDir);

  // Classic script: safe in srcDoc iframes (no module/CORS constraints).
  // Registers JSON onto a single global object: globalThis.__zyncContextEnginePacks.
  const js = [
    '(function(){',
    '  const root = (globalThis.__zyncContextEnginePacks ||= {});',
    `  const kind = (root[${JSON.stringify(provider)}] ||= {});`,
    `  kind[${JSON.stringify(language)}] = ${jsonText.trim()};`,
    '})();',
    '',
  ].join('\n');

  await writeFile(path.join(outDir, `${language}.js`), js, 'utf8');
};

for (const provider of providers) {
  for (const language of languages) {
    const srcPath = path.join(dataRoot, provider, `${language}.json`);
    let jsonText = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      jsonText = await readFile(srcPath, 'utf8');
    } catch {
      // Optional: skip missing packs (keeps config future-proof).
      // eslint-disable-next-line no-console
      console.warn(`[context-engine] missing ${provider}/${language}.json; skipping`);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await writePack({ provider, language, jsonText });
    } catch (error) {
      // If we fail to write, surface the actual error (permissions, disk full, etc.)
      throw new Error(
        `[context-engine] failed to write pack ${provider}/${language}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

await ensureDir(distRoot);
await writeFile(
  path.join(distRoot, 'manifest.json'),
  JSON.stringify({ source: '@enjoys/context-engine', providers, languages }, null, 2) + '\n',
  'utf8'
);

console.log(`[context-engine] generated assets -> ${path.relative(root, distRoot)}`);
