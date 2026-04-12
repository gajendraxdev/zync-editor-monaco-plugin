import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import './widgets.css';
import { bindMonacoCommands, createPrimaryShortcutHandler, type MonacoShortcutActions } from './shortcuts';
import { ensureContextEngine, getContextEngineSnapshot } from './contextEngine';

declare global {
  interface Window {
    zyncEditor?: {
      onMessage: (callback: (message: unknown) => void) => () => void;
      emitReady: (payload?: unknown) => void;
      emitChange: (payload?: unknown) => void;
      emitDirtyChange: (dirty: boolean) => void;
      requestSave: (content: string) => void;
      requestClose: () => void;
      reportError: (code: string, message: string, fatal?: boolean) => void;
    };
    __zyncMonacoDebug?: {
      monaco: typeof monaco;
      editor: monaco.editor.IStandaloneCodeEditor;
      getContextEngineSnapshot: () => { enabledLanguages: string[]; enabledCount: number };
      getHiddenLineRanges?: () => Array<{ startLine: number; endLine: number }>;
    };
  }
}

type HostMessage =
  | { type: 'zync:editor:init'; payload?: { pluginId?: string; theme?: { mode?: 'light' | 'dark'; colors?: Record<string, string> } } }
  | { type: 'zync:editor:open-document'; payload?: { docId?: string; language?: string; content?: string; readOnly?: boolean } }
  | { type: 'zync:editor:update-document'; payload?: { docId?: string; content?: string } }
  | { type: 'zync:editor:set-readonly'; payload?: { readOnly?: boolean } }
  | { type: 'zync:editor:set-theme'; payload?: { mode?: 'light' | 'dark'; colors?: Record<string, string> } }
  | { type: 'zync:editor:focus' }
  | { type: 'zync:editor:dispose' };

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'json',
  'html',
  'css',
  'markdown',
  'python',
  'rust',
  'xml',
  'yaml',
  'sql',
  'shell',
  'plaintext',
]);

const container = document.getElementById('editor-root');
if (!container) {
  throw new Error('Missing #editor-root container');
}
const bootLoading = document.getElementById('boot-loading');
const setBootState = (busy: boolean, message?: string) => {
  if (!bootLoading) return;
  bootLoading.setAttribute('aria-busy', busy ? 'true' : 'false');
  if (message) bootLoading.textContent = message;
  if (!busy) bootLoading.style.display = 'none';
};

(window as Window & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    // Keep runtime lightweight: use the generic editor worker for everything.
    // We rely on context-engine packs for completions/hover/definition instead of LSP.
    // (Monaco's language-service workers add significant bundle + memory cost.)
    void label;
    return new editorWorker();
  },
};

const editor = monaco.editor.create(container, {
  value: '',
  language: 'plaintext',
  automaticLayout: true,
  minimap: { enabled: true },
  fontSize: 13,
  lineNumbersMinChars: 3,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  scrollBeyondLastLine: false,
  renderWhitespace: 'selection',
  quickSuggestions: true,
  contextmenu: true,
  folding: true,
  // Needed for our "collapsed range" gutter toggle. This is a small UI cost
  // but keeps the feature discoverable and familiar.
  glyphMargin: true,
  // Make folding discoverable without needing to hover.
  showFoldingControls: 'always',
  // Prefer richer folding when Monaco provides it; fall back automatically.
  foldingStrategy: 'auto',
  find: {
    addExtraSpaceOnTop: false,
  },
});
if (bootLoading) {
  setBootState(false);
}

const isMonacoPluginDebugEnabled = () => {
  try {
    return window.localStorage.getItem('zync.debug.monaco') === '1';
  } catch {
    return false;
  }
};

const isContextEngineEnabled = () => {
  try {
    // Enabled by default; allow opt-out for ultra-minimal builds or debugging.
    return window.localStorage.getItem('zync.monaco.disableContextEngine') !== '1';
  } catch {
    return true;
  }
};

window.__zyncMonacoDebug = {
  monaco,
  editor,
  getContextEngineSnapshot,
  getHiddenLineRanges: () => hiddenLineRanges.slice(),
};

let currentDocId: string | undefined;
let savedContent = '';

const emitChange = () => {
  const content = editor.getValue();
  window.zyncEditor?.emitChange({ docId: currentDocId, content });
  window.zyncEditor?.emitDirtyChange(content !== savedContent);
};

editor.onDidChangeModelContent(emitChange);

const runEditorAction = (actionId: string): boolean => {
  const action = editor.getAction(actionId);
  if (action) {
    void action.run();
    return true;
  }
  return false;
};

/**
 * "Collapse selection" (range folding) for cases where Monaco doesn't have
 * language folding ranges, or the user wants to hide arbitrary line spans.
 *
 * We implement this using editor hidden areas (line-based), not LSP.
 * This is intentionally lightweight and reversible.
 */
type HiddenLineRange = { startLine: number; endLine: number };
let hiddenLineRanges: HiddenLineRange[] = [];
const collapsedDecorationCollection = editor.createDecorationsCollection();

const mergeHiddenLineRanges = (ranges: HiddenLineRange[]): HiddenLineRange[] => {
  const sorted = ranges
    .filter((r) => r.endLine >= r.startLine)
    .slice()
    .sort((a, b) => (a.startLine - b.startLine) || (a.endLine - b.endLine));

  const merged: HiddenLineRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...range });
      continue;
    }
    if (range.startLine <= last.endLine + 1) {
      last.endLine = Math.max(last.endLine, range.endLine);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
};

const setHiddenAreas = (areas: monaco.IRange[]) => {
  const anyEditor = editor as unknown as { setHiddenAreas?: (ranges: monaco.IRange[]) => void };
  if (typeof anyEditor.setHiddenAreas === 'function') {
    anyEditor.setHiddenAreas(areas);
  } else if (isMonacoPluginDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.warn('[monaco-plugin] setHiddenAreas unavailable; collapsed range UI will not work in this Monaco build.');
  }
};

const updateCollapsedRangeDecorations = () => {
  const model = editor.getModel();
  if (!model) {
    collapsedDecorationCollection.clear();
    return;
  }

  const decorations = hiddenLineRanges
    .map((r) => {
      const visibleLine = Math.max(1, r.startLine - 1);
      return {
        range: new monaco.Range(visibleLine, 1, visibleLine, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'zync-collapsed-range-glyph',
          glyphMarginHoverMessage: [
            {
              value: `Collapsed lines ${r.startLine}-${r.endLine}. Click gutter to expand.`,
              isTrusted: true,
            },
          ],
        },
      };
    });

  collapsedDecorationCollection.set(decorations);
};

const applyHiddenAreas = () => {
  const model = editor.getModel();
  if (!model) return;
  const areas = hiddenLineRanges.map((r) => new monaco.Range(
    r.startLine,
    1,
    r.endLine,
    model.getLineMaxColumn(r.endLine)
  ));
  setHiddenAreas(areas);
  updateCollapsedRangeDecorations();
};

const clearHiddenAreas = () => {
  hiddenLineRanges = [];
  setHiddenAreas([]);
  collapsedDecorationCollection.clear();
};

const collapseSelectionAsHiddenArea = (selection: monaco.Selection) => {
  const model = editor.getModel();
  if (!model) return;

  const startLine = Math.min(selection.startLineNumber, selection.endLineNumber);
  const endLine = Math.max(selection.startLineNumber, selection.endLineNumber);
  if (startLine === endLine) return;

  // Keep the first line visible; hide the remainder.
  const hideStart = startLine + 1;
  const hideEnd = endLine;
  if (hideStart > hideEnd) return;

  hiddenLineRanges = mergeHiddenLineRanges([
    ...hiddenLineRanges,
    { startLine: hideStart, endLine: hideEnd },
  ]);
  applyHiddenAreas();
};

const expandCollapsedAtLine = (visibleLine: number) => {
  const targetStartLine = visibleLine + 1;
  const before = hiddenLineRanges.length;
  hiddenLineRanges = hiddenLineRanges.filter((r) => r.startLine !== targetStartLine);
  if (hiddenLineRanges.length !== before) {
    applyHiddenAreas();
  }
};

// Clicking the glyph in the gutter expands that collapsed range.
editor.onMouseDown((e) => {
  const line = e.target.position?.lineNumber;
  if (!line) return;
  const el = (e.target as unknown as { element?: HTMLElement }).element;
  const hit = el?.closest?.('.zync-collapsed-range-glyph');
  if (!hit) return;
  expandCollapsedAtLine(line);
  e.event.preventDefault();
  e.event.stopPropagation();
});

// Some OS / IME setups intercept Ctrl+Space. Provide a secondary keybinding for suggestions.
editor.addCommand(
  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Space,
  () => {
    runEditorAction('editor.action.triggerSuggest');
  }
);

editor.addAction({
  id: 'zync.action.collapseSelection',
  label: 'Collapse Selection',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft],
  contextMenuGroupId: 'navigation',
  contextMenuOrder: 1.45,
  run: () => {
    const selection = editor.getSelection();
    if (!selection) return;
    if (selection.isEmpty()) {
      // Best-effort: fall back to folding at cursor if the language provides ranges.
      runEditorAction('editor.fold');
      return;
    }
    collapseSelectionAsHiddenArea(selection);
    return;
  },
});

editor.addAction({
  id: 'zync.action.expandAllCollapsedRanges',
  label: 'Expand All Collapsed Ranges',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketRight],
  contextMenuGroupId: 'navigation',
  contextMenuOrder: 1.46,
  run: () => {
    clearHiddenAreas();
    // Also unfold everything, just in case the user used language folding.
    runEditorAction('editor.unfoldAll');
    return;
  },
});

const resolveLanguage = (language?: string) => {
  const lang = (language ?? '').toLowerCase();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : 'plaintext';
};


const gotoWidget = document.createElement('div');
gotoWidget.id = 'zync-goto-widget';
gotoWidget.setAttribute('role', 'group');
gotoWidget.hidden = true;

const gotoLabel = document.createElement('span');
gotoLabel.id = 'zync-goto-label';
gotoLabel.className = 'zync-visually-hidden';
gotoLabel.textContent = 'Go to line and column';

const gotoHint = document.createElement('span');
gotoHint.id = 'zync-goto-hint';
gotoHint.className = 'zync-visually-hidden';
gotoHint.textContent = 'Format: line:column';

const gotoInput = document.createElement('input');
gotoInput.id = 'zync-goto-input';
gotoInput.type = 'text';
gotoInput.placeholder = 'line:column';
gotoInput.setAttribute('aria-labelledby', 'zync-goto-label');
gotoInput.setAttribute('aria-describedby', 'zync-goto-hint');

const gotoGo = document.createElement('button');
gotoGo.id = 'zync-goto-go';
gotoGo.type = 'button';
gotoGo.textContent = 'Go';
gotoGo.setAttribute('aria-label', 'Apply go to line');

gotoWidget.appendChild(gotoLabel);
gotoWidget.appendChild(gotoHint);
gotoWidget.appendChild(gotoInput);
gotoWidget.appendChild(gotoGo);
container.appendChild(gotoWidget);

const submitGoto = () => {
  const raw = gotoInput.value.trim();
  const [lineRaw, colRaw] = raw.split(':');
  const lineNumber = Number.parseInt(lineRaw, 10);
  const column = colRaw ? Number.parseInt(colRaw, 10) : 1;
  if (!Number.isFinite(lineNumber) || lineNumber < 1) return;
  const target = {
    lineNumber,
    column: Number.isFinite(column) && column > 0 ? column : 1,
  };
  editor.revealPositionInCenter(target);
  editor.setPosition(target);
  gotoWidget.hidden = true;
  editor.focus();
};

gotoGo.addEventListener('click', submitGoto);
gotoInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitGoto();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    gotoWidget.hidden = true;
    editor.focus();
  }
});

const shortcutActions: MonacoShortcutActions = {
  save: () => window.zyncEditor?.requestSave(editor.getValue()),
  close: () => window.zyncEditor?.requestClose(),
  find: () => {
    runEditorAction('actions.find');
  },
  replace: () => {
    runEditorAction('editor.action.startFindReplaceAction');
  },
  gotoLine: () => {
    runGotoLinePrompt();
  },
  toggleComment: () => {
    runEditorAction('editor.action.commentLine');
  },
};

bindMonacoCommands(editor, shortcutActions);
window.addEventListener('keydown', createPrimaryShortcutHandler(shortcutActions), true);

const defineTheme = (mode: 'light' | 'dark', colors: Record<string, string>) => {
  const themeName = `zync-monaco-${mode}`;
  const border = colors.border ?? (mode === 'light' ? '#d1d5db' : '#374151');
  const surface = colors.surface ?? (mode === 'light' ? '#f8fafc' : '#1f2937');
  const bg = colors.background ?? (mode === 'light' ? '#ffffff' : '#0f111a');
  const text = colors.text ?? (mode === 'light' ? '#111827' : '#e5e7eb');
  const muted = colors.muted ?? (mode === 'light' ? '#6b7280' : '#94a3b8');
  const primary = colors.primary ?? '#3b82f6';
  monaco.editor.defineTheme(themeName, {
    base: mode === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': bg,
      'editor.foreground': text,
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': text,
      'editorCursor.foreground': primary,
      'editor.selectionBackground': `${primary}44`,
      'editor.findMatchBackground': `${primary}66`,
      'editor.findMatchHighlightBackground': `${primary}33`,

      // Generic widgets + inputs
      'editorWidget.background': surface,
      'editorWidget.border': border,
      'input.background': bg,
      'input.foreground': text,
      'input.border': border,

      // Suggest + hover widgets (explicit to avoid “surprise” borders)
      'editorSuggestWidget.background': surface,
      'editorSuggestWidget.border': border,
      'editorSuggestWidget.foreground': text,
      'editorSuggestWidget.selectedBackground': `${primary}22`,
      'editorSuggestWidget.highlightForeground': primary,
      'editorSuggestWidget.focusHighlightForeground': primary,

      'editorHoverWidget.background': surface,
      'editorHoverWidget.border': border,
      'editorHoverWidget.foreground': text,
      'editorHoverWidget.statusBarBackground': bg,

      // Buttons
      'button.background': primary,
      'button.foreground': mode === 'light' ? '#ffffff' : '#f8fafc',

      // Global focus/outline color used by many Monaco widgets.
      // If unset, some builds can fall back to an alarming red.
      focusBorder: primary,
    },
  });
  monaco.editor.setTheme(themeName);

  // Hard override: ensure Monaco's CSS variables used by widgets are consistent.
  // Monaco often writes these CSS variables on the editor DOM node, which can
  // override :root-level values. We set them with !important at multiple levels.
  //
  // NOTE: This intentionally overrides host app theming for certain Monaco widget
  // borders/backgrounds to avoid surprise "red borders" in some Monaco builds.
  // Integrators can opt out by setting:
  //   localStorage.setItem('zync.monaco.disableCssVarOverrides', '1')
  const applyVars = (el: HTMLElement | null) => {
    if (!el) return;
    const set = (name: string, value: string) => el.style.setProperty(name, value, 'important');
    set('--vscode-focusBorder', primary);
    set('--vscode-widget-border', border);
    set('--vscode-editorWidget-border', border);
    set('--vscode-editorSuggestWidget-border', border);
    set('--vscode-editorHoverWidget-border', border);
    set('--vscode-input-border', border);
    set('--vscode-inputOption-activeBorder', primary);
    set('--vscode-editor-background', bg);
    set('--vscode-editor-foreground', text);
    set('--vscode-editorWidget-background', surface);
  };

  const disableOverrides = (() => {
    try {
      return window.localStorage.getItem('zync.monaco.disableCssVarOverrides') === '1';
    } catch {
      return false;
    }
  })();

  if (!disableOverrides) {
    applyVars(document.documentElement);
    applyVars(document.body);
    applyVars(editor.getDomNode());
  }
};

const onMessage = (raw: unknown) => {
  const message = raw as HostMessage;
  try {
    switch (message.type) {
      case 'zync:editor:init':
        // Apply initial theme immediately if host provided it (avoids a flash).
        if (message.payload?.theme) {
          defineTheme(message.payload.theme.mode ?? 'dark', message.payload.theme.colors ?? {});
        }
        break;
      case 'zync:editor:open-document': {
        // Clear any ad-hoc collapsed ranges when switching documents.
        clearHiddenAreas();
        const content = message.payload?.content ?? '';
        const model = editor.getModel();
        if (!model) break;
        model.setValue(content);
        const lang = resolveLanguage(message.payload?.language);
        monaco.editor.setModelLanguage(model, lang);
        // Best-effort: enable context-engine providers for this language (lazy-loaded assets).
        if (isContextEngineEnabled()) {
          void ensureContextEngine(monaco, lang);
        }
        if (isMonacoPluginDebugEnabled()) {
          // eslint-disable-next-line no-console
          console.debug('[monaco-plugin] open-document', { lang, snapshot: getContextEngineSnapshot() });
        }
        editor.updateOptions({ readOnly: Boolean(message.payload?.readOnly) });
        currentDocId = message.payload?.docId;
        savedContent = content;
        window.zyncEditor?.emitDirtyChange(false);
        editor.focus();
        break;
      }
      case 'zync:editor:update-document': {
        const content = message.payload?.content ?? '';
        const model = editor.getModel();
        if (!model) break;
        model.setValue(content);
        savedContent = content;
        window.zyncEditor?.emitDirtyChange(false);
        break;
      }
      case 'zync:editor:set-readonly':
        editor.updateOptions({ readOnly: Boolean(message.payload?.readOnly) });
        break;
      case 'zync:editor:set-theme':
        defineTheme(message.payload?.mode ?? 'dark', message.payload?.colors ?? {});
        break;
      case 'zync:editor:focus':
        editor.focus();
        break;
      case 'zync:editor:dispose':
        editor.dispose();
        break;
      default:
        break;
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    window.zyncEditor?.reportError('MONACO_RUNTIME_ERROR', messageText, false);
  }
};

window.zyncEditor?.onMessage(onMessage);
window.zyncEditor?.emitReady({
  supports: [
    'search',
    'replace',
    'goto-line',
    'syntax-highlight',
    'folding',
    'multi-selection',
    'completion',
    'hover',
    'definition',
    'minimap',
  ],
});
const runGotoLinePrompt = () => {
  const current = editor.getPosition();
  gotoInput.value = current ? `${current.lineNumber}:${current.column}` : '1:1';
  gotoWidget.hidden = false;
  gotoInput.focus();
  gotoInput.select();
};

window.addEventListener('error', () => {
  if (bootLoading?.getAttribute('aria-busy') === 'true') {
    setBootState(
      false,
      'Failed to initialize Monaco editor. Please reopen this file or reinstall the plugin.'
    );
  }
});
