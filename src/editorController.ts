import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { registerCommands } from './commands';
import { createModelUri, languageLabel, resolveLanguage } from './languages';
import type { EditorDocument } from './types';
import { ZyncBridge } from './bridge';
import { DocumentLifecycle } from './documentLifecycle';

const LARGE_DOCUMENT_CHARACTERS = 1_000_000;

export class EditorController {
  readonly #bridge: ZyncBridge;
  readonly #editor: monaco.editor.IStandaloneCodeEditor;
  readonly #disposables: monaco.IDisposable[] = [];
  readonly #positionElement: HTMLElement;
  readonly #languageElement: HTMLElement;
  readonly #lifecycle = new DocumentLifecycle();

  #model: monaco.editor.ITextModel | null = null;
  #language = 'plaintext';
  #largeDocument = false;
  #dirty = false;
  #saveResultsSupported = false;
  #applyingHostUpdate = false;
  #disposed = false;

  constructor(
    container: HTMLElement,
    positionElement: HTMLElement,
    languageElement: HTMLElement,
    bridge: ZyncBridge,
  ) {
    this.#bridge = bridge;
    this.#positionElement = positionElement;
    this.#languageElement = languageElement;
    this.#editor = monaco.editor.create(container, {
      model: null,
      automaticLayout: true,
      accessibilitySupport: 'auto',
      bracketPairColorization: { enabled: true },
      codeLens: true,
      contextmenu: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      detectIndentation: true,
      dragAndDrop: true,
      fixedOverflowWidgets: true,
      folding: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontLigatures: false,
      fontSize: 13,
      fontWeight: '400',
      glyphMargin: true,
      guides: { bracketPairs: true, indentation: true },
      hideCursorInOverviewRuler: true,
      largeFileOptimizations: true,
      lineDecorationsWidth: 10,
      lineHeight: 21,
      lineNumbersMinChars: 3,
      links: true,
      minimap: {
        enabled: true,
        maxColumn: 80,
        renderCharacters: false,
        scale: 1,
        showSlider: 'mouseover',
        size: 'fit',
      },
      mouseWheelZoom: true,
      multiCursorModifier: 'alt',
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      padding: { top: 10, bottom: 12 },
      renderLineHighlight: 'all',
      renderLineHighlightOnlyWhenFocus: true,
      renderWhitespace: 'selection',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      scrollbar: {
        horizontalScrollbarSize: 10,
        verticalScrollbarSize: 10,
        useShadows: false,
      },
      smoothScrolling: true,
      showFoldingControls: 'always',
      stickyScroll: { enabled: true, maxLineCount: 5 },
      suggest: { preview: true, showStatusBar: true },
      tabSize: 2,
      unicodeHighlight: { ambiguousCharacters: false },
      wordWrap: 'off',
    });

    this.#disposables.push(
      this.#editor.onDidChangeModelContent(() => this.#handleContentChange()),
      this.#editor.onDidChangeCursorPosition(({ position }) => {
        this.#positionElement.textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
      }),
      ...registerCommands(this.#editor, {
        save: () => this.save(),
        close: () => this.#bridge.close(),
      }),
    );
  }

  open(document: EditorDocument): void {
    this.#assertActive();
    if (this.#lifecycle.docId === document.docId && this.#lifecycle.dirty) {
      // A duplicate open is not permission to replace newer unsaved text.
      this.#editor.updateOptions({ readOnly: Boolean(document.readOnly) });
      return;
    }
    const language = resolveLanguage(document.language, document.filename);
    const large = document.content.length >= LARGE_DOCUMENT_CHARACTERS;
    const nextUri = createModelUri(document.docId, document.filename);
    const previousModel = this.#model;
    const reuseModel = previousModel?.uri.toString() === nextUri.toString();
    // Monaco permits one live model per URI. Reuse it on repeated opens.
    const nextModel = reuseModel
      ? previousModel
      : monaco.editor.createModel(document.content, large ? 'plaintext' : language, nextUri);
    this.#applyingHostUpdate = true;
    try {
      this.#language = language;
      if (reuseModel && nextModel) {
        if (nextModel.getValue() !== document.content) nextModel.setValue(document.content);
      }
      this.#model = nextModel;
      this.#lifecycle.open(document.docId, nextModel.getAlternativeVersionId());
      this.#editor.setModel(nextModel);
      this.#editor.updateOptions({ readOnly: Boolean(document.readOnly) });
      this.#setLargeDocumentMode(large);
    } finally {
      this.#applyingHostUpdate = false;
    }
    if (!reuseModel) previousModel?.dispose();

    this.#setDirty(false);
    this.#positionElement.textContent = 'Ln 1, Col 1';
    requestAnimationFrame(() => this.focus());
  }

  update(docId: string | undefined, content: string): void {
    if (!this.#model || !this.#lifecycle.canApplyHostUpdate(docId)) return;
    this.#applyingHostUpdate = true;
    try {
      if (this.#model.getValue() !== content) this.#model.setValue(content);
      this.#setLargeDocumentMode(content.length >= LARGE_DOCUMENT_CHARACTERS);
      this.#lifecycle.acceptHostUpdate(this.#model.getAlternativeVersionId());
      this.#setDirty(false);
    } finally {
      this.#applyingHostUpdate = false;
    }
  }

  saveResult(payload: { docId?: string; requestId?: number; ok?: boolean } | undefined): void {
    if (!payload || typeof payload.docId !== 'string' ||
        typeof payload.requestId !== 'number') return;
    if (this.#lifecycle.confirmSave(payload.requestId, payload.docId, payload.ok === true)) {
      this.#setDirty(this.#lifecycle.dirty);
    }
  }

  setReadOnly(docId: string | undefined, readOnly: boolean): void {
    if (!this.#lifecycle.isCurrentDocument(docId)) return;
    this.#editor.updateOptions({ readOnly });
  }

  setSaveResultsSupported(supported: boolean): void {
    this.#saveResultsSupported = supported;
  }

  focus(): void {
    this.#editor.focus();
  }

  save(): void {
    if (!this.#model) return;
    const request = this.#lifecycle.requestSave(this.#model.getValue());
    if (!request) return;
    // Old hosts use change payloads to update their save baseline. Updated
    // hosts get the content with the save request and need no edit snapshots.
    if (!this.#saveResultsSupported) this.#bridge.changed(request.docId, request.content);
    this.#bridge.save(request.content, request);
    if (!this.#saveResultsSupported) {
      // Hosts released before save results use the original best-effort contract.
      this.#lifecycle.confirmSave(request.requestId, request.docId, true);
      this.#setDirty(this.#lifecycle.dirty);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#disposables.forEach((disposable) => disposable.dispose());
    this.#model?.dispose();
    this.#model = null;
    this.#editor.dispose();
  }

  #handleContentChange(): void {
    if (this.#applyingHostUpdate || !this.#model) return;
    this.#lifecycle.change(this.#model.getAlternativeVersionId());
    this.#setDirty(this.#lifecycle.dirty);
    const large = this.#model.getValueLength() >= LARGE_DOCUMENT_CHARACTERS;
    if (large !== this.#largeDocument) {
      this.#setLargeDocumentMode(large);
    }
  }

  #setLargeDocumentMode(large: boolean): void {
    this.#largeDocument = large;
    if (this.#model) {
      const modelLanguage = large ? 'plaintext' : this.#language;
      if (this.#model.getLanguageId() !== modelLanguage) {
        monaco.editor.setModelLanguage(this.#model, modelLanguage);
      }
    }
    this.#languageElement.textContent = large ? 'Plain Text · Large file mode' : languageLabel(this.#language);
    this.#editor.updateOptions({
      bracketPairColorization: { enabled: !large },
      codeLens: !large,
      folding: !large,
      hover: { enabled: !large },
      minimap: { enabled: !large },
      quickSuggestions: !large,
      stickyScroll: { enabled: !large },
      suggestOnTriggerCharacters: !large,
    });
  }

  #setDirty(dirty: boolean): void {
    if (dirty === this.#dirty) return;
    this.#dirty = dirty;
    this.#bridge.dirtyChanged(dirty, this.#lifecycle.docId ?? undefined);
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('Cannot open a document after editor disposal');
  }
}
