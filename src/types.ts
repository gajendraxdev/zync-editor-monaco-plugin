import type { ZyncEditorBridge, ZyncEditorStatus } from '@zync-sh/plugin-sdk/editor';

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

export type EditorStatusReport = ZyncEditorStatus & { language: string };

export type EditorHostCommand = 'save' | 'find' | 'find-replace' | 'goto-line';

export type HostMessage =
  | { type: 'zync:editor:bootstrap'; payload?: Record<string, never> }
  | { type: 'zync:editor:init'; payload?: { pluginId?: string; theme?: ThemePayload; saveResults?: boolean } }
  | { type: 'zync:editor:open-document'; payload?: Partial<EditorDocument> }
  | { type: 'zync:editor:update-document'; payload?: Pick<Partial<EditorDocument>, 'docId' | 'content'> }
  | { type: 'zync:editor:set-readonly'; payload?: { docId?: string; readOnly?: boolean } }
  | { type: 'zync:editor:save-result'; payload?: { docId?: string; requestId?: number; ok?: boolean } }
  | { type: 'zync:editor:command'; payload?: { docId?: string; command?: EditorHostCommand } }
  | { type: 'zync:editor:set-theme'; payload?: ThemePayload }
  | { type: 'zync:editor:focus' }
  | { type: 'zync:editor:dispose' };

export type HostBridge = ZyncEditorBridge;

declare global {
  interface Window {
    zyncEditor?: HostBridge;
    __zyncResolveEditorAsset?: (relativePath: string) => string;
  }
}
