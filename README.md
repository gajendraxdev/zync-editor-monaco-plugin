# Zedit

Zedit is a Monaco-powered editor provider for Zync. It is a new plugin identity,
`com.zync.editor.zedit`, and does not replace or update the legacy
`com.zync.editor.monaco` plugin.

## Architecture

The plugin deliberately keeps the host boundary small:

- `bridge.ts` owns all communication with Zync.
- `editorController.ts` owns the Monaco editor, active model and lifecycle.
- `languages.ts` maps host language hints and filenames to Monaco languages.
- `workers.ts` routes Monaco's native language workers lazily.
- `theme.ts` applies validated `@zync-sh/plugin-ui` tokens and converts them
  into a Monaco theme.
- `commands.ts` contains host-facing editor commands.

Only one text model is retained. Switching documents disposes the previous model.
Edits are tracked by Monaco version rather than copying the full file to the
host on each change. The host receives file content when saving; dirty-state
messages are deduplicated, and every Monaco registration is disposed with the
editor. TypeScript/JavaScript,
JSON, HTML and CSS intelligence comes from Monaco itself. No external completion
or context engine is bundled.

For files of at least one million characters, Zedit uses plain-text mode and
turns off the minimap, folding, suggestions and hover processing. Editing and
saving remain available without starting a language worker for that file.
On updated Zync builds the modified state clears only after Zync confirms a
successful save; older builds retain their existing save behavior.

The desktop file API still reads and writes complete files. Large-file mode
reduces editor work and avoids per-edit document copies, but opening and saving
very large files still require memory for the full file on both sides of the
plugin boundary. A streaming file API would be needed to remove that limit.

## Development

```powershell
npm ci
npm run check
```

The build produces `editor.html`, the files in `dist/`, and
`artifacts/zedit-0.1.0.zip`. The release check also validates the packaged
files with the pinned `@zync-sh/plugin-sdk` preflight validator.

## Install for local testing

1. Run `npm run build`.
2. Open **Settings → Plugins → Developer** in Zync.
3. Install `artifacts/zedit-0.1.0.zip`.
4. Choose **Zedit** as the default editor and open a text file.

The legacy Monaco plugin can remain installed because Zedit has a separate plugin
ID. Disable the legacy provider while testing to avoid choosing the wrong editor.

## Releasing

The `zedit-v<version>` tag workflow builds and checks a draft release candidate.
Publisher signing and marketplace onboarding are separate; see [RELEASING.md](RELEASING.md)
before pushing a release tag.
