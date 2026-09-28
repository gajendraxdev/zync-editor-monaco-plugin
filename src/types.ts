export interface ThemeColors {
  background?: string;
  surface?: string;
  border?: string;
  text?: string;
  muted?: string;
  primary?: string;
}

export interface ThemePayload {
  mode?: 'light' | 'dark';
  colors?: ThemeColors;
}

export interface EditorDocument {
  docId: string;
  filename?: string;
  language?: string;
  content: string;
  readOnly?: boolean;
}

export type HostMessage =
  | { type: 'zync:editor:bootstrap'; payload?: Record<string, never> }
  | { type: 'zync:editor:init'; payload?: { pluginId?: string; theme?: ThemePayload; saveResults?: boolean } }
  | { type: 'zync:editor:open-document'; payload?: Partial<EditorDocument> }
  | { type: 'zync:editor:update-document'; payload?: Pick<Partial<EditorDocument>, 'docId' | 'content'> }
  | { type: 'zync:editor:set-readonly'; payload?: { docId?: string; readOnly?: boolean } }
  | { type: 'zync:editor:save-result'; payload?: { docId?: string; requestId?: number; ok?: boolean } }
  | { type: 'zync:editor:set-theme'; payload?: ThemePayload }
  | { type: 'zync:editor:focus' }
  | { type: 'zync:editor:dispose' };

export interface HostBridge {
  onMessage(callback: (message: unknown) => void): () => void;
  emitReady(payload?: unknown): void;
  emitChange(payload?: unknown): void;
  emitDirtyChange(dirty: boolean, docId?: string): void;
  requestSave(content: string, request?: { docId: string; requestId: number }): void;
  requestClose(): void;
  reportError(code: string, message: string, fatal?: boolean): void;
}

declare global {
  interface Window {
    zyncEditor?: HostBridge;
    __zyncResolveEditorAsset?: (relativePath: string) => string;
  }
}
