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

Before tagging, configure a protected GitHub Actions environment named
`plugin-release` in the repository that will host the release. Restrict it to
the intended Zedit tags and require reviewer approval. Add:

- environment secret `ZEDIT_PUBLISHER_PRIVATE_KEY`: the complete Ed25519
  publisher private PEM, not the registry root key;
- optional environment secret `ZEDIT_PUBLISHER_KEY_PASSPHRASE` if that PEM is
  encrypted;
- environment variable `ZEDIT_PUBLISHER_KEY_ID`: the approved `sha256:...`
  fingerprint for Zedit's publisher binding.

The existing `com.zync` publisher key can be reused, but approval is scoped to
the Zedit plugin/repository as well as the key. Do not print, commit or upload
the private key. The signing job checks out the Zync SDK signer at a reviewed,
full commit SHA because the currently pinned published SDK does not include
`signing.js`; review and deliberately update that pin when changing signer code.

For version `0.1.0`, create `zedit-v0.1.0` on the merged release commit and
push the tag to the release repository. The workflow checks version
consistency, runs `npm run check`, signs the exact tested payload in the
protected environment, verifies its signature and fingerprint, checks the
archive after repacking, and publishes only the signed ZIP and its SHA-256
checksum. The public publish job has no signing secret. Do not reuse or move a
release tag after publication.

## 3. Check the release

Confirm the Actions run succeeded and the GitHub release contains only
`zedit-<version>-signed.zip` and its `.sha256` file. Verify the downloaded ZIP
with Zync's SDK signer or install it in a real Zync build. If the signing job
fails, fix the environment or source and issue a new version/tag rather than
replacing a published release asset with different bytes.

## 4. Marketplace is a separate publication

A GitHub release does not make Zedit appear in Zync's marketplace. The trusted
registry must separately approve the `com.zync.editor.zedit` plugin/repository/
publisher-key binding, include its signed release, and publish a higher signed
registry version. The current `zync-extensions` registry preparer only handles
PM2, so Zedit needs reviewed onboarding there; do not treat approval of another
`com.zync` plugin as approval of Zedit.
