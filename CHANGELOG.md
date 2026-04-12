# Changelog

All notable changes to the Monaco editor-provider plugin for Zync.

## [Unreleased]

## [0.1.30]

### Added
- Host-injected asset resolver for reliable pack loading inside `srcDoc` iframes. ([f6d16eb])
- GitHub Actions release workflow to attach built plugin zip to tag releases. ([f6d16eb])

### Changed
- Hardened context-engine pack loading (timeouts, retries, better URL resolution). ([f6d16eb])
- Build scripts now discover the JS bundle name instead of hardcoding `editor.js`. ([f6d16eb])
- Documented debug/opt-out flags for context-engine and CSS-variable overrides. ([f6d16eb])

### Fixed
- Prevented double borders on hover widgets. ([f6d16eb])
- Removed extra blank lines in definition hover metadata rendering. ([f6d16eb])

