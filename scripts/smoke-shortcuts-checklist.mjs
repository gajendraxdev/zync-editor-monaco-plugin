import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const checklist = [
  ['Ctrl/Cmd+F', 'Find widget opens and input accepts typing'],
  ['Ctrl/Cmd+H', 'Replace mode opens and replace input accepts typing'],
  ['Ctrl/Cmd+G', 'Go-to widget opens, Enter jumps to line/column'],
  ['Ctrl/Cmd+S', 'Save request is sent and host status updates to Saved'],
  ['Ctrl/Cmd+W', 'Close request is sent to host (respecting unsaved confirmation)'],
];

const now = new Date().toISOString();
const lines = [
  '# Monaco Shortcut Smoke Checklist',
  '',
  `Generated: ${now}`,
  '',
  'Run inside Zync after installing this plugin build:',
  '',
  ...checklist.map(([key, expected]) => `- [ ] **${key}** — ${expected}`),
  '',
];

const outputDir = path.join(process.cwd(), 'artifacts');
const outputFile = path.join(outputDir, 'SMOKE_SHORTCUTS_CHECKLIST.md');
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, lines.join('\n'), 'utf8');

console.log(`Shortcut smoke checklist written to: ${outputFile}`);
