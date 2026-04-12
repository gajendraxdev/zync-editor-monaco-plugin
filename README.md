# zync-editor-monaco-plugin

Monaco editor-provider plugin for Zync.

Current tested local artifact baseline: **v0.1.30**.

## Build

```bash
npm install
npm run build
npm run smoke:shortcuts # Optional: generate manual QA checklist
```

Build output creates `editor.html` that references `dist/editor.js` + `dist/editor.css`.
Zync loads the HTML via `srcDoc` and injects a base URL so the assets are fetched from disk
(enabling WebView caching for faster repeat opens).

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
- Optional context-engine language intelligence (completion/hover/definition) loaded lazily from
  local `dist/context-engine/*` assets generated at build time from the npm package `@enjoys/context-engine`.
- Shortcut map centralized in `src/shortcuts.ts`
- Widget styles centralized in `src/widgets.css`

## Context-engine language intelligence

This plugin can provide lightweight completions / hover / definition without an LSP server.
The packs are generated at build time and shipped inside the plugin zip:

```bash
npm install
npm run build
```

Runtime behavior:
- Enabled by default for supported languages (see `src/main.ts` → `ensureContextEngine()` call on open-document).
- Disable (opt-out):
```js
localStorage.setItem('zync.monaco.disableContextEngine', '1')
```
- Debug: `localStorage.setItem('zync.debug.contextEngine', '1')`

## Monaco widget CSS variable overrides (red-border hardening)

Some Monaco builds can show unexpected focus outlines/borders on hover/suggest widgets.
To keep UX consistent, the plugin sets a handful of `--vscode-*` CSS variables with `!important`.

Opt-out (integrators):
```js
localStorage.setItem('zync.monaco.disableCssVarOverrides', '1')
```
