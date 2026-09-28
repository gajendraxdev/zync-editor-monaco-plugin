import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const aliases: Readonly<Record<string, string>> = {
  bash: 'shell',
  cjs: 'javascript',
  htm: 'html',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shell',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
};

const extensionOf = (filename?: string): string | undefined => {
  const match = filename?.toLowerCase().match(/\.([a-z0-9][a-z0-9.+-]*)$/);
  return match?.[1];
};

export const resolveLanguage = (language?: string, filename?: string): string => {
  const requested = language?.trim().toLowerCase();
  const candidate = requested && requested !== 'text' ? requested : extensionOf(filename);
  if (!candidate) return 'plaintext';
  return aliases[candidate] ?? candidate;
};

const safeSegment = (value: string): string => encodeURIComponent(value.replace(/[\\/]+/g, '-'));

export const createModelUri = (docId: string, filename?: string): monaco.Uri => {
  const name = filename?.trim() || 'untitled.txt';
  return monaco.Uri.parse(`inmemory://zedit/${safeSegment(docId)}/${safeSegment(name)}`);
};

export const languageLabel = (language: string): string => {
  if (language === 'plaintext') return 'Plain Text';
  if (language === 'javascript') return 'JavaScript';
  if (language === 'typescript') return 'TypeScript';
  if (language === 'json') return 'JSON';
  if (language === 'html') return 'HTML';
  if (language === 'css') return 'CSS';
  if (language === 'sql') return 'SQL';
  return language.charAt(0).toUpperCase() + language.slice(1);
};
