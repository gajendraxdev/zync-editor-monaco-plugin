# Changelog

All notable changes to Zedit are documented here.

## [Unreleased]

### Changed

- Align editor typography, gutter spacing, active-line treatment, minimap,
  scrollbars and status chrome with Zync's built-in file editor.
- Use Monaco's integrated glyph and folding margin so line numbers, gutter
  controls and document content align consistently with VS Code.
- Use the pinned published Zync SDK for package preflight validation and the
  shared Zync plugin UI package for theme tokens and control foundations.

### Fixed

- Keep unsaved edits marked as modified until updated Zync hosts confirm the
  save; retain the existing best-effort behavior on older hosts. Preserve
  changes made while a save is in progress or a file is switching.
- Ignore read-only updates for another document and recover the host-update
  guard if Monaco throws while applying an open or content update.
- Reuse the active Monaco model when the same document is reopened, avoiding
  duplicate URI collisions; dispose the previous model when switching documents.
  Large files use plain-text mode and fewer editor features
  to avoid starting language workers; edits no longer clone the whole file
  into host messages until Save is requested.
- Recover the editor handshake when the host bootstrap arrives after an early
  ready signal, without recreating an already-open document.
- Load Monaco language workers from package assets on demand and run them as
  sandbox-local blob workers, preserving iframe isolation and low idle memory.
- Inline Monaco's codicon font so Find/Replace controls render inside the
  sandbox, and restyle the responsive two-row Find/Replace widget with Zync's
  shared UI tokens and accessible focus states.

## [0.1.0]

### Added

- New `com.zync.editor.zedit` identity, isolated from the legacy Monaco plugin.
- Modular host bridge, editor lifecycle, commands, language, worker and theme layers.
- Monaco-native TypeScript/JavaScript, JSON, HTML and CSS language services.
- Broad built-in syntax highlighting, search, replace, folding, navigation,
  multi-cursor editing, formatting, hover, definition and minimap support.
- Compact line, column and language status bar.

### Changed

- Retains only one document model and lazily starts language workers to constrain memory.
- Sends full document content to the host only when Save is requested, while
  reporting dirty-state transitions immediately.

### Removed

- `@enjoys/context-engine` runtime and generated language-pack assets.
- Legacy implementation-specific widgets, debug hooks and build scripts.
