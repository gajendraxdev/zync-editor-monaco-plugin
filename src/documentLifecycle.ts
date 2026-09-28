export interface SaveRequest {
  requestId: number;
  docId: string;
  content: string;
}

/** Keeps document identity and save acknowledgements independent of Monaco's UI. */
export class DocumentLifecycle {
  #docId: string | null = null;
  #version = 0;
  #savedVersion = 0;
  #nextRequestId = 0;
  #latestSaveRequestId = 0;
  #latestSaveVersion = 0;

  get docId(): string | null {
    return this.#docId;
  }

  get dirty(): boolean {
    return this.#version !== this.#savedVersion;
  }

  open(docId: string, version: number): void {
    this.#docId = docId;
    this.#version = version;
    this.#savedVersion = version;
    this.#latestSaveRequestId = 0;
    this.#latestSaveVersion = 0;
  }

  change(version: number): void {
    if (this.#docId) this.#version = version;
  }

  canApplyHostUpdate(docId: string | undefined): boolean {
    return Boolean(this.#docId && (!docId || docId === this.#docId) && !this.dirty);
  }

  isCurrentDocument(docId: string | undefined): boolean {
    return typeof docId === 'string' && docId === this.#docId;
  }

  acceptHostUpdate(version: number): void {
    this.#version = version;
    this.#savedVersion = version;
  }

  requestSave(content: string): SaveRequest | null {
    if (!this.#docId) return null;
    const requestId = ++this.#nextRequestId;
    this.#latestSaveRequestId = requestId;
    this.#latestSaveVersion = this.#version;
    return { requestId, docId: this.#docId, content };
  }

  confirmSave(requestId: number, docId: string, ok: boolean): boolean {
    if (!ok || docId !== this.#docId || requestId !== this.#latestSaveRequestId) return false;
    this.#savedVersion = this.#latestSaveVersion;
    return true;
  }
}
