# Releasing Zedit

Zedit (`com.zync.editor.zedit`) is a new plugin identity. The legacy Monaco
plugin and its `v0.1.30` tag are separate; Zedit tags use `zedit-v<version>`.
The version in `manifest.json` and `package.json` must match the tag.

## 1. Prepare the source

Run `npm ci` and `npm run check`, then install the produced ZIP in a real Zync
build and smoke-test open, switch, edit, save, failed save, Find/Replace and
read-only behavior. Commit and merge the release source and workflow to the
repository that should host the release. The `origin` remote in a local fork
does not publish to `zync-sh` automatically.

## 2. Start the tagged workflow

For version `0.1.0`, create `zedit-v0.1.0` on that merged commit and push the
tag to the release repository. The tag workflow checks version consistency,
runs the full plugin check and creates a **draft** GitHub release containing an
unsigned candidate ZIP. It does not publish that candidate or put it into the
marketplace. Do not reuse or move a release tag after publishing.

## 3. Sign the tested candidate

Download the candidate ZIP from the draft release and expand it into a fresh
directory outside the source repository. It must have `manifest.json`,
`editor.html` and `dist/` at its root. Sign that exact candidate, not a new
local build. The local Zync SDK signer accepts the existing `com.zync` publisher
key; a separate key needs its own approval for this plugin. Keep the private
key and signed output outside Git.

```powershell
node ..\zync\packages\plugin-sdk\bin\zync-plugin.mjs sign --source <candidate-directory> --key <publisher-private.pem> --out <new-signed-directory>
node ..\zync\packages\plugin-sdk\bin\zync-plugin.mjs verify --source <new-signed-directory>
```

Check the reported fingerprint against the approved key for **this plugin ID**.
ZIP the *contents* of the signed directory, so `integrity.json` and
`signature.json` are at the ZIP root, and verify the ZIP's extracted contents
once more. Upload the signed ZIP to the draft release, remove its unsigned
candidate ZIP, and publish the draft only after the signed asset and notes are
reviewed. The currently pinned published SDK lacks unattended signing support,
so this step is deliberately manual rather than exposing a key to the build job.

## 4. Marketplace is a separate publication

A GitHub release does not make Zedit appear in Zync's marketplace. The trusted
registry must separately approve the `com.zync.editor.zedit` plugin/repository/
publisher-key binding, include its signed release, and publish a higher signed
registry version. The current `zync-extensions` registry preparer only handles
PM2, so Zedit needs reviewed onboarding there; do not treat approval of another
`com.zync` plugin as approval of Zedit.
