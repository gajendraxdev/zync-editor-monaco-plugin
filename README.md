# zync-editor-monaco-plugin

Monaco editor-provider plugin for Zync.

## Build

```bash
npm install
npm run build
npm run smoke:shortcuts # Optional: generate manual QA checklist
```

Build output creates `editor.html` (inline JS/CSS) for Zync's iframe `srcDoc` runtime.

## Install in Zync (local QA)

1. Zip this folder with `manifest.json` at the zip root.
2. In Zync open **Settings → Plugins → Developer**.
3. Use **Install ZIP package** or **Install from folder**.
4. Set default editor to **Monaco** and open a file.

## Current scope

- Host bridge wiring (`zync:editor:*` messages)
- Open/update/focus/dispose document lifecycle
- Change + dirty + save-request + request-close events
- Theme-follow support via `zync:editor:set-theme`
- Shortcut map centralized in `src/shortcuts.ts`
- Widget styles centralized in `src/widgets.css`
