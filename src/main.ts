import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js';
import 'monaco-editor/esm/vs/editor/contrib/gotoError/browser/gotoError.js';
import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/links/browser/links.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/esm/vs/basic-languages/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/css/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import '@zync-sh/plugin-ui/styles.css';
import './styles.css';

import { ZyncBridge } from './bridge';
import { EditorController } from './editorController';
import { applyTheme } from './theme';
import type { EditorDocument } from './types';
import { configureWorkers } from './workers';

const supportedCapabilities = [
  'save',
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
] as const;

const requiredElement = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
};

const normalizeDocument = (value: Partial<EditorDocument> | undefined): EditorDocument | null => {
  if (!value || typeof value.docId !== 'string' || typeof value.content !== 'string') return null;
  return {
    docId: value.docId,
    filename: typeof value.filename === 'string' ? value.filename : undefined,
    language: typeof value.language === 'string' ? value.language : undefined,
    content: value.content,
    readOnly: value.readOnly === true,
  };
};

const start = (): void => {
  configureWorkers();
  applyTheme();
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(false);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(false);

  const bridge = new ZyncBridge();
  const announceReady = (): void => bridge.ready([...supportedCapabilities]);
  const controller = new EditorController(
    requiredElement('editor-root'),
    requiredElement('status-position'),
    requiredElement('status-language'),
    bridge,
  );

  const unsubscribe = bridge.subscribe((message) => {
    try {
      switch (message.type) {
        case 'zync:editor:bootstrap':
          // The host sends this after iframe load. Re-advertising readiness closes
          // the race where the initial ready event arrived before its listener.
          announceReady();
          break;
        case 'zync:editor:init':
          applyTheme(message.payload?.theme);
          controller.setSaveResultsSupported(message.payload?.saveResults === true);
          break;
        case 'zync:editor:open-document': {
          const document = normalizeDocument(message.payload);
          if (!document) throw new Error('Host sent an invalid document');
          controller.open(document);
          break;
        }
        case 'zync:editor:update-document':
          if (typeof message.payload?.content === 'string') {
            controller.update(message.payload.docId, message.payload.content);
          }
          break;
        case 'zync:editor:set-readonly':
          controller.setReadOnly(message.payload?.docId, message.payload?.readOnly === true);
          break;
        case 'zync:editor:save-result':
          controller.saveResult(message.payload);
          break;
        case 'zync:editor:set-theme':
          applyTheme(message.payload);
          break;
        case 'zync:editor:focus':
          controller.focus();
          break;
        case 'zync:editor:dispose':
          unsubscribe();
          controller.dispose();
          break;
      }
    } catch (error) {
      bridge.error('ZEDIT_HOST_MESSAGE_FAILED', error);
    }
  });

  window.addEventListener('pagehide', () => controller.dispose(), { once: true });
  requiredElement('boot-loading').remove();
  announceReady();
};

try {
  start();
} catch (error) {
  const loading = document.getElementById('boot-loading');
  if (loading) loading.textContent = 'Zedit could not start.';
  window.zyncEditor?.reportError(
    'ZEDIT_START_FAILED',
    error instanceof Error ? error.message : String(error),
    true,
  );
}
