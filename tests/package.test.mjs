import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('Zedit has an identity separate from the legacy Monaco plugin', async () => {
  const manifest = await json('manifest.json');
  const packageJson = await json('package.json');

  assert.equal(manifest.id, 'com.zync.editor.zedit');
  assert.equal(manifest.name, 'Zedit');
  assert.equal(manifest.version, packageJson.version);
  assert.notEqual(manifest.id, 'com.zync.editor.monaco');
});

test('the build has no external context engine', async () => {
  const packageJson = await json('package.json');
  const dependencyNames = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ];
  const distEntries = await readdir('dist', { recursive: true });

  assert.equal(dependencyNames.some((name) => name.includes('context-engine')), false);
  assert.equal(distEntries.some((name) => name.includes('context-engine')), false);
});

test('the plugin uses pinned Zync authoring and UI packages', async () => {
  const packageJson = await json('package.json');

  assert.equal(packageJson.devDependencies['@zync-sh/plugin-sdk'], '2.1.0-beta.1');
  assert.equal(packageJson.devDependencies['@zync-sh/plugin-ui'], '0.1.0-beta.1');
});

test('the generated entry uses cacheable external assets', async () => {
  const html = await readFile('editor.html', 'utf8');
  assert.match(html, /dist\/editor\.css/);
  assert.match(html, /dist\/editor\.js/);
  assert.doesNotMatch(html, /context-engine/);
});

test('the Monaco icon font is self-contained for the sandboxed editor frame', async () => {
  const css = await readFile('dist/editor.css', 'utf8');
  const distEntries = await readdir('dist');

  assert.match(css, /@font-face\{font-family:codicon[^}]+data:font\/ttf;base64,/);
  assert.equal(distEntries.some((name) => name.includes('codicon') && name.endsWith('.ttf')), false);
});

test('the editor keeps VS Code-style gutter and folding alignment', async () => {
  const source = await readFile('src/editorController.ts', 'utf8');
  const theme = await readFile('src/theme.ts', 'utf8');

  assert.match(source, /glyphMargin: true/);
  assert.match(source, /showFoldingControls: 'always'/);
  assert.match(theme, /'editorGutter\.background': colors\.background/);
});

test('the editor repeats its ready signal when the host bootstraps the frame', async () => {
  const source = await readFile('src/main.ts', 'utf8');

  assert.match(source, /case 'zync:editor:bootstrap':/);
  assert.match(source, /announceReady\(\);/);
});

test('language workers are converted to same-frame blob workers on demand', async () => {
  const source = await readFile('src/workers.ts', 'utf8');

  assert.match(source, /await fetch\(assetUrl/);
  assert.match(source, /URL\.createObjectURL\(new Blob/);
  assert.match(source, /URL\.revokeObjectURL\(blobUrl\)/);
  assert.doesNotMatch(source, /return new Worker\(url/);
});
