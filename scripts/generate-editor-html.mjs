import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const templatePath = path.join(root, 'src', 'editor-shell.html');
const distPath = path.join(root, 'dist');
const outputPath = path.join(root, 'editor.html');

const template = await readFile(templatePath, 'utf8');

const files = await readdir(distPath);
const cssFile = files.find((name) => name === 'editor.css') ?? files.find((name) => name.endsWith('.css')) ?? null;
const jsFile = files.find((name) => name === 'editor.js')
  ?? files.find((name) => name.endsWith('.js') && name.includes('editor'))
  ?? null;

const cssTag = cssFile
  ? `<link rel="stylesheet" href="./dist/${cssFile}">`
  : '';

// Important: keep JS external so WebView caching can kick in.
if (!jsFile) {
  throw new Error('[generate-editor-html] Missing editor JS bundle in dist/. Build may have failed.');
}
const jsTag = `<script src="./dist/${jsFile}"></script>`;

const html = template
  .replace('<!-- __CSS__ -->', cssTag)
  .replace('<!-- __JS__ -->', jsTag);

await writeFile(outputPath, html, 'utf8');
