# Release & auto-updater setup

The codebase is wired for code-signed, notarised, auto-updateable releases via
GitHub Actions, but it needs a one-time secrets/keys setup. Until those are
provided the release workflow still runs and produces an unsigned `.dmg`.

## 1. Tauri updater signing keys (one-time)

The updater plugin verifies downloaded artefacts against an Ed25519 signature.
Generate the keypair locally:

```bash
pnpm exec tauri signer generate -w ~/.tauri/frajola-updater.key
```

This produces a private key (write to disk only, **never** commit) and a public
key printed to stdout.

Then:

1. Add a `plugins.updater` block to `src-tauri/tauri.conf.json` (currently
   empty `"plugins": {}`):
   ```json
   "plugins": {
     "updater": {
       "endpoints": [
         "https://github.com/victorlucss/frajola/releases/latest/download/latest.json"
       ],
       "pubkey": "<paste the printed public key here>"
     }
   }
   ```
2. Re-add `"createUpdaterArtifacts": true` to the `bundle` section so the
   release build emits the `app.tar.gz` + signature artefacts.
3. Add the private key contents and its password as repo secrets:
   - `TAURI_SIGNING_PRIVATE_KEY` — full file contents
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password chosen when generating

## 2. Apple Developer ID (macOS code-signing + notarisation)

You need an active **Apple Developer Program** membership ($99/yr). Once
enrolled, in the Apple Developer portal create a "Developer ID Application"
certificate. Export it from Keychain as a `.p12` file with a password.

Add as repo secrets:

- `APPLE_CERTIFICATE` — base64 of the `.p12` (`base64 -i cert.p12 | pbcopy`)
- `APPLE_CERTIFICATE_PASSWORD` — the password set during export
- `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: Your Name (TEAMID)`

For notarisation also set:

- `APPLE_ID` — the Apple ID email
- `APPLE_PASSWORD` — an [app-specific password](https://appleid.apple.com/account/manage)
- `APPLE_TEAM_ID` — your team ID (visible in the Developer portal)
- `APPLE_NOTARIZE` — set to `"true"` to enable the notarisation branch in the workflow

## 3. Cutting a release

```bash
git tag -a v0.3.0 -m "..."
git push origin v0.3.0
```

The `Release` workflow (`.github/workflows/release.yml`) builds for macOS
(arm64 + x64), Linux, and Windows; signs and notarises macOS bundles when the
secrets above are present; produces a `latest.json` updater manifest that the
in-app `tauri-plugin-updater` checks against the GitHub Releases endpoint
configured in `src-tauri/tauri.conf.json`.

## 4. Verifying the updater

After a release is published:

1. Install the previous version locally.
2. Bump the version, push a new tag, wait for the release.
3. Launch the installed app — the updater plugin will pull `latest.json`,
   verify the Ed25519 signature, and prompt the user to install.
