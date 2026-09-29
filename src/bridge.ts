import type { EditorStatusReport, HostBridge, HostMessage } from './types';

const isHostMessage = (value: unknown): value is HostMessage => {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && type.startsWith('zync:editor:');
};

export class ZyncBridge {
  readonly #host: HostBridge;

  constructor(host = window.zyncEditor) {
    if (!host) throw new Error('Zync editor bridge is unavailable');
    this.#host = host;
  }

  subscribe(listener: (message: HostMessage) => void): () => void {
    return this.#host.onMessage((message) => {
      if (isHostMessage(message)) listener(message);
    });
  }

  ready(supports: string[]): void {
    this.#host.emitReady({ supports });
  }

  changed(docId: string, content: string): void {
    this.#host.emitChange({ docId, content });
  }

  dirtyChanged(dirty: boolean, docId: string): void {
    this.#host.emitDirtyChange(dirty, docId);
  }

  status(report: EditorStatusReport): void {
    this.#host.reportStatus(report);
  }

  save(content: string, request: { docId: string; requestId: number }): void {
    this.#host.requestSave(content, request);
  }

  close(): void {
    this.#host.requestClose();
  }

  error(code: string, error: unknown, fatal = false): void {
    const message = error instanceof Error ? error.message : String(error);
    this.#host.reportError(code, message, fatal);
  }
}
