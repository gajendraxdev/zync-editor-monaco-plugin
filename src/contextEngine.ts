import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

type Monaco = typeof monaco;

type CompletionData = { completions?: Array<any> } | null;
type HoverData = { hovers?: Record<string, { contents?: Array<{ value: string }> }> } | null;
type DefinitionData = {
  definitions?: Record<string, { signature?: string; description?: string; type?: string; module?: string }>;
} | null;

type ProviderKind = 'completion' | 'hover' | 'definition';
type DataPack = CompletionData | HoverData | DefinitionData;

const registered = new Map<string, monaco.IDisposable[]>();

declare global {
  // eslint-disable-next-line no-var
  var __zyncContextEnginePacks:
    | Record<string, Record<string, unknown>>
    | undefined;
  // eslint-disable-next-line no-var
  var __zyncEditorAssetBase: string | undefined;
  // eslint-disable-next-line no-var
  var __zyncResolveEditorAsset: ((relativePath: string) => string) | undefined;
}

const loaded = new Map<string, Promise<void>>();
let resolvedContextEngineBase: string | null = null;
let resolvingContextEngineBase: Promise<string> | null = null;

function isContextEngineDebugEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('zync.debug.contextEngine') === '1';
  } catch {
    return false;
  }
}

function getDistBaseUrl(): string | null {
  // Best: the host can tell us exactly where plugin assets are served from.
  // (Avoids brittle script-tag scanning, which can pick up the wrong editor.js.)
  const injected = globalThis.__zyncEditorAssetBase;
  if (injected) {
    try {
      // Normalize: ensure trailing slash.
      return new URL('./', injected).toString();
    } catch {
      // ignore
    }
  }

  // Preferred: Vite bundles this file as an ES module, so import.meta.url
  // is the most reliable way to locate the currently-loaded editor bundle.
  // (It remains stable even when called from async callbacks/message handlers.)
  try {
    if (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
      return new URL('./', import.meta.url).toString();
    }
  } catch {
    // ignore
  }

  // Our bundle is loaded via <script src=".../dist/editor.js">.
  // Find it robustly (not via currentScript, which is null during message handlers).
  const scripts = Array.from(document.getElementsByTagName('script'));
  // Important: prefer the plugin's /dist/editor.js over any other "editor.js"
  // the host page might include.
  const byDist = scripts.find((s) => /\/dist\/editor\.js(\?|#|$)/i.test(s.src || ''));
  const byName = scripts.find((s) => /editor\.js(\?|#|$)/i.test(s.src || ''));
  const candidate = byDist ?? byName;

  const src = candidate?.src;
  if (!src) return null;
  try {
    return new URL('./', src).toString();
  } catch {
    return null;
  }
}

function resolveEditorAssetUrl(relativePath: string): string | null {
  const rel = String(relativePath || '').replace(/^\/+/, '');
  const resolver = globalThis.__zyncResolveEditorAsset;
  if (typeof resolver === 'function') {
    try {
      return resolver(rel);
    } catch {
      // ignore
    }
  }

  const base = getDistBaseUrl();
  if (!base) return null;
  try {
    return new URL(rel, base).toString();
  } catch {
    return null;
  }
}

async function resolveContextEngineBaseUrl(): Promise<string> {
  if (resolvedContextEngineBase) return resolvedContextEngineBase;
  if (resolvingContextEngineBase) return resolvingContextEngineBase;

  const debug = isContextEngineDebugEnabled();

  const candidates: string[] = [];
  const pushCandidate = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.endsWith('/') ? value : `${value}/`;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  const injected = globalThis.__zyncEditorAssetBase;
  if (injected) {
    pushCandidate(injected);
    // Common in Tauri: an origin-root base still serves plugin dist at /dist/.
    try {
      pushCandidate(new URL('dist/', injected).toString());
    } catch {
      // ignore
    }
  }

  const computed = getDistBaseUrl();
  pushCandidate(computed);
  if (computed) {
    try {
      pushCandidate(new URL('dist/', computed).toString());
    } catch {
      // ignore
    }
  }

  // From script tags (try both script dir and dir + "dist/").
  for (const s of Array.from(document.getElementsByTagName('script'))) {
    const src = (s as HTMLScriptElement).src || '';
    if (!src) continue;
    if (!/editor\.js(\?|#|$)/i.test(src)) continue;
    try {
      const dir = new URL('./', src).toString();
      pushCandidate(dir);
      pushCandidate(new URL('dist/', dir).toString());
    } catch {
      // ignore
    }
  }

  const probe = async (base: string) => {
    // If the host injected an asset resolver, prefer that, because base URL
    // joining can fail when paths are encoded in query params.
    const manifestUrl =
      resolveEditorAssetUrl('context-engine/manifest.json')
      ?? new URL('context-engine/manifest.json', base).toString();
    try {
      const res = await fetch(manifestUrl, { method: 'GET' });
      return res.ok ? base : null;
    } catch {
      return null;
    }
  };

  resolvingContextEngineBase = (async () => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.debug('[context-engine] resolving base', { injected, candidates });
    }
    for (const base of candidates) {
      const ok = await probe(base);
      if (ok) {
        resolvedContextEngineBase = ok;
        if (debug) {
          // eslint-disable-next-line no-console
          console.debug('[context-engine] resolved base', ok);
        }
        return ok;
      }
    }

    const fallback = candidates[0] ?? 'dist/';
    resolvedContextEngineBase = fallback;
    if (debug) {
      // eslint-disable-next-line no-console
      console.debug('[context-engine] probe failed; using fallback', fallback);
    }
    return fallback;
  })();

  return resolvingContextEngineBase;
}

function packKey(kind: ProviderKind, lang: string) {
  return `${kind}:${lang}`;
}

function loadPack(kind: ProviderKind, lang: string): Promise<void> {
  const key = packKey(kind, lang);
  const existing = loaded.get(key);
  if (existing) return existing;

  const LOAD_TIMEOUT_MS = 10_000;

  const p = resolveContextEngineBaseUrl().then((base) => new Promise<void>((resolve, reject) => {
    const url =
      resolveEditorAssetUrl(`context-engine/${kind}/${lang}.js`)
      ?? new URL(`context-engine/${kind}/${lang}.js`, base).toString();

    const script = document.createElement('script');
    script.async = true;
    script.src = url;

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Allow retries after failures (e.g., transient load errors).
      loaded.delete(key);
      reject(error);
    };

    script.onload = () => succeed();
    script.onerror = () => fail(new Error(`Failed to load ${url}`));
    timeoutId = setTimeout(() => fail(new Error(`Timed out loading ${url}`)), LOAD_TIMEOUT_MS);

    document.head.appendChild(script);
  })).catch((error) => {
    // Ensure we don't cache a rejection forever.
    loaded.delete(key);
    throw error;
  });
  loaded.set(key, p);
  return p;
}

function getPack(kind: ProviderKind, lang: string): DataPack | null {
  const root = globalThis.__zyncContextEnginePacks;
  if (!root) return null;
  const bucket = root[kind];
  if (!bucket) return null;
  return (bucket[lang] ?? null) as DataPack | null;
}

const completionTriggersByLang: Record<string, string[] | undefined> = {
  javascript: ['.', '"', '\'', '/', '@', '<', ':', '-', '_'],
  typescript: ['.', '"', '\'', '/', '@', '<', ':', '-', '_'],
  python: ['.', '_', ':', '(', '['],
  rust: ['.', ':', '<', '(', '@', '_'],
  json: ['"', ':', ','],
  yaml: [':', '-', ' '],
  shell: ['-', '/', '.', ' '],
};

function toCompletionProvider(monacoNs: Monaco, langId: string, data: CompletionData): monaco.languages.CompletionItemProvider | null {
  const items = data?.completions;
  if (!items?.length) return null;

  return {
    triggerCharacters: completionTriggersByLang[langId],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = items.map((item: any) => ({
        label: item.label,
        kind: item.kind,
        detail: item.detail,
        documentation: item.documentation?.value
          ? { value: item.documentation.value, isTrusted: true }
          : undefined,
        insertText: item.insertText,
        insertTextRules: item.insertTextRules,
        sortText: item.sortText,
        filterText: item.filterText,
        range,
      }));

      return { suggestions };
    },
  };
}

function toHoverProvider(_monacoNs: Monaco, data: HoverData): monaco.languages.HoverProvider | null {
  const hovers = data?.hovers;
  if (!hovers || !Object.keys(hovers).length) return null;

  return {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const entry = hovers[word.word] ?? hovers[word.word.toLowerCase()];
      if (!entry?.contents?.length) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
        contents: entry.contents.map((c) => ({
          value: c.value,
          isTrusted: true,
          supportThemeIcons: true,
        })),
      };
    },
  };
}

function toDefinitionHoverProvider(data: DefinitionData): monaco.languages.HoverProvider | null {
  const defs = data?.definitions;
  if (!defs || !Object.keys(defs).length) return null;

  return {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const entry = defs[word.word] ?? defs[word.word.toLowerCase()];
      if (!entry) return null;

      const lines: string[] = [];
      if (entry.signature) lines.push(`**${entry.signature}**`);
      if (entry.description) lines.push(entry.description);
      const meta = [entry.type, entry.module].filter(Boolean).join(' · ');
      if (meta) lines.push(`_${meta}_`);

      if (!lines.length) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
        contents: [{ value: lines.join('\n\n'), isTrusted: true }],
      };
    },
  };
}

export async function ensureContextEngine(monacoNs: Monaco, languageId: string): Promise<void> {
  if (!languageId || registered.has(languageId)) return;

  await Promise.allSettled([
    loadPack('completion', languageId),
    loadPack('hover', languageId),
    loadPack('definition', languageId),
  ]);

  const completionPack = getPack('completion', languageId) as CompletionData;
  const hoverPack = getPack('hover', languageId) as HoverData;
  const definitionPack = getPack('definition', languageId) as DefinitionData;

  const disposables: monaco.IDisposable[] = [];

  const completionProvider = toCompletionProvider(monacoNs, languageId, completionPack);
  if (completionProvider) {
    disposables.push(monacoNs.languages.registerCompletionItemProvider(languageId, completionProvider));
  }

  const hoverProvider = toHoverProvider(monacoNs, hoverPack);
  if (hoverProvider) {
    disposables.push(monacoNs.languages.registerHoverProvider(languageId, hoverProvider));
  }

  const defHoverProvider = toDefinitionHoverProvider(definitionPack);
  if (defHoverProvider) {
    disposables.push(monacoNs.languages.registerHoverProvider(languageId, defHoverProvider));
  }

  if (!disposables.length) return;
  registered.set(languageId, disposables);
  // eslint-disable-next-line no-console
  console.log(`[context-engine] enabled for ${languageId} (${disposables.length} providers)`);
}

export function disposeContextEngine(languageId?: string) {
  if (languageId) {
    const ds = registered.get(languageId);
    if (ds) ds.forEach((d) => d.dispose());
    registered.delete(languageId);
    return;
  }
  for (const ds of registered.values()) ds.forEach((d) => d.dispose());
  registered.clear();
}

export function getContextEngineSnapshot() {
  return {
    enabledLanguages: Array.from(registered.keys()).sort(),
    enabledCount: registered.size,
  };
}
