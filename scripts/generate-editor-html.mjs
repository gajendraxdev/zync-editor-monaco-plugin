import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const templatePath = path.join(root, 'src', 'editor-shell.html');
const jsPath = path.join(root, 'dist', 'editor.js');
const cssPath = path.join(root, 'dist', 'editor.css');
const outputPath = path.join(root, 'editor.html');

const [template, js] = await Promise.all([
  readFile(templatePath, 'utf8'),
  readFile(jsPath, 'utf8'),
]);

let css = '';
try {
  css = await readFile(cssPath, 'utf8');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    css = '';
  } else {
    throw error;
  }
}

const encodedJs = Buffer.from(js, 'utf8').toString('base64');
const encodedCss = Buffer.from(css, 'utf8').toString('base64');

const html = template
  .replace(
    '<!-- __BOOTSTRAP__ -->',
    `<script>
(() => {
  const decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const css = decode('${encodedCss}');
  if (css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  const script = document.createElement('script');
  script.textContent = decode('${encodedJs}');
  document.body.appendChild(script);
})();
</script>`
  );

await writeFile(outputPath, html, 'utf8');
