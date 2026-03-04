# Release Guide

This project publishes desktop installers through GitHub Releases using:

- Workflow: `.github/workflows/release.yml`
- Trigger: `v*` tags (for example `v0.1.0`)
- Targets: macOS (Apple Silicon + Intel), Windows, Linux

## What The Workflow Does

1. Validates the release tag format (`vX.Y.Z` or pre-release variant).
2. Verifies tag version matches both:
   - `package.json` `version`
   - `src-tauri/tauri.conf.json` `version`
3. Builds Tauri bundles per platform.
4. Creates/updates the GitHub Release and uploads installers.

## Required Secrets

Basic release upload works with the default GitHub token.

For signed/notarized macOS builds, configure:

- `APPLE_SIGNING_IDENTITY`
- `APPLE_CERTIFICATE` (base64-encoded `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD` (app-specific password)
- `APPLE_TEAM_ID`

For updater signatures (optional, future auto-updates):

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Release Steps

1. Update versions:
   - `package.json`
   - `src-tauri/tauri.conf.json`
2. Commit changes.
3. Create the tag:

```bash
git tag v0.1.0
```

4. Push tag:

```bash
git push origin v0.1.0
```

5. Wait for the `Release` workflow to finish.
6. Verify release assets in GitHub Releases.

## Website Download Links

`site/index.html` uses `site/js/release-links.js` to resolve platform-specific installers from:

- `https://api.github.com/repos/victorlucss/frajola/releases/latest`

If direct matching fails, links fall back to:

- `https://github.com/victorlucss/frajola/releases/latest`
