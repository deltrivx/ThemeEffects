# Development and Release Policy

This repository uses a single-branch workflow.

## Branch policy

- `main` is the only long-lived development branch.
- Do not create `agent/*`, `fix/*`, `release/*`, version, or temporary remote branches.
- Changes are committed directly to `main` after verification.
- GitHub releases are represented by immutable version tags, not release branches.

## Version policy

- Stable releases use `vMAJOR.MINOR.PATCH`.
- Pre-releases use `vMAJOR.MINOR.PATCH-beta.N`.
- Update the plugin version, version index, changelog, snapshots, and release assets before creating a version tag.
- A stable tag produces a stable GitHub Release. A beta tag produces a GitHub pre-release.
- Only the newest stable release is marked as Latest.

## Release workflow

1. Commit verified changes to `main`.
2. Update all version metadata on `main`.
3. Create the appropriate version tag from the verified `main` commit.
4. Let GitHub Actions build and publish the release from that tag.

Do not create a release branch or publish a release from an arbitrary branch.
