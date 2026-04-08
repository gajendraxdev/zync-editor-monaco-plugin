import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export interface MonacoShortcutActions {
  save: () => void;
  close: () => void;
  find: () => void;
  replace: () => void;
  gotoLine: () => void;
  toggleComment: () => void;
}

const commandBindings: Array<{ keybinding: number; run: (actions: MonacoShortcutActions) => void }> = [
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, run: (a) => a.save() },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, run: (a) => a.close() },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, run: (a) => a.find() },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, run: (a) => a.replace() },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, run: (a) => a.gotoLine() },
  { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, run: (a) => a.toggleComment() },
];

const primaryShortcutMap: Record<string, keyof MonacoShortcutActions> = {
  s: 'save',
  w: 'close',
  f: 'find',
  h: 'replace',
  g: 'gotoLine',
  '/': 'toggleComment',
};

export function bindMonacoCommands(
  editor: monaco.editor.IStandaloneCodeEditor,
  actions: MonacoShortcutActions
) {
  for (const binding of commandBindings) {
    editor.addCommand(binding.keybinding, () => binding.run(actions));
  }
}

export function createPrimaryShortcutHandler(actions: MonacoShortcutActions) {
  return (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    const actionName = primaryShortcutMap[key];
    if (actionName) {
      event.preventDefault();
      event.stopPropagation();
      actions[actionName]();
    }
  };
}
