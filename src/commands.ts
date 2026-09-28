import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export interface EditorCommands {
  save(): void;
  close(): void;
}

export const registerCommands = (
  editor: monaco.editor.IStandaloneCodeEditor,
  commands: EditorCommands,
): monaco.IDisposable[] => [
  editor.addAction({
    id: 'zedit.save',
    label: 'Save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: commands.save,
  }),
  editor.addAction({
    id: 'zedit.close',
    label: 'Close Editor',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW],
    run: commands.close,
  }),
];
