import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { applyTheme as applyPluginTheme } from '@zync-sh/plugin-ui';
import type { ThemePayload } from './types';

const fallback = {
  dark: { background: '#0f1115', surface: '#17191f', border: '#2b2e38', text: '#e5e7eb', muted: '#9ca3af', primary: '#7c73e6' },
  light: { background: '#ffffff', surface: '#f6f7f9', border: '#d9dce3', text: '#1f2937', muted: '#6b7280', primary: '#5b55c8' },
} as const;

const withAlpha = (value: string, alpha: string, fallbackColor: string): string => {
  return /^#[0-9a-f]{6}$/i.test(value) ? `${value}${alpha}` : fallbackColor;
};

export const applyTheme = (payload: ThemePayload = {}): void => {
  const sharedTheme = applyPluginTheme(payload);
  const mode = sharedTheme.mode === 'light' ? 'light' : 'dark';
  const colors = { ...fallback[mode], ...sharedTheme.colors };
  const name = `zedit-${mode}`;

  monaco.editor.defineTheme(name, {
    base: mode === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': colors.background,
      'editor.foreground': colors.text,
      'editorLineNumber.foreground': colors.muted,
      'editorLineNumber.activeForeground': colors.text,
      'editorGutter.background': colors.background,
      'editorCursor.foreground': colors.primary,
      'editor.selectionBackground': withAlpha(colors.primary, '45', '#7c73e645'),
      'editor.inactiveSelectionBackground': withAlpha(colors.primary, '24', '#7c73e624'),
      'editor.lineHighlightBackground': withAlpha(colors.primary, '12', '#7c73e612'),
      'editor.lineHighlightBorder': '#00000000',
      'editorWidget.background': colors.surface,
      'editorWidget.border': colors.border,
      'editorSuggestWidget.background': colors.surface,
      'editorSuggestWidget.border': colors.border,
      'editorHoverWidget.background': colors.surface,
      'editorHoverWidget.border': colors.border,
      'minimap.background': colors.background,
      'scrollbarSlider.background': withAlpha(colors.muted, '25', '#9ca3af25'),
      'scrollbarSlider.hoverBackground': withAlpha(colors.muted, '45', '#9ca3af45'),
      'scrollbarSlider.activeBackground': withAlpha(colors.muted, '60', '#9ca3af60'),
      'focusBorder': colors.primary,
    },
  });
  monaco.editor.setTheme(name);
};
