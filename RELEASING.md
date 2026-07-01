# Releasing ez-money

Releases are built and published by GitHub Actions (`.github/workflows/release.yml`)
when you push a `vX.Y.Z` tag. Auto-update (electron-updater) then delivers them to
already-installed apps.

## Cut a release

1. Bump the app version in **`desktop/package.json`** — this drives the installer
   name, the update feed, and the version installed apps compare against.
2. Update `CHANGELOG.md`.
3. Commit, then tag and push:
   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag vX.Y.Z
   git push && git push origin vX.Y.Z
   ```
4. The **Release** workflow builds the Windows installer + Linux AppImage and uploads
   them to a GitHub Release **as a draft**, with the update feeds (`latest.yml`,
   `latest-linux.yml`).
5. **Publish the draft** — required for auto-update to deliver it:
   ```bash
   gh release edit vX.Y.Z --draft=false --latest
   ```
   (or click **Publish release** on GitHub). electron-updater only reads the latest
   *published* (non-draft) release, so a release left as a draft reaches nobody.

> Prefer hands-off? Set `"releaseType": "release"` under `build.publish` in
> `desktop/package.json` and CI publishes live automatically — at the cost of the
> review/test gate (worth keeping while builds aren't GUI-tested in CI).

## How auto-update works

- `desktop/package.json` → `build.publish` (github) bakes **`app-update.yml`** into the
  app, so the installed build knows to check this repo's releases.
- On launch, packaged builds call `autoUpdater.checkForUpdatesAndNotify()`
  (`desktop/src/main/main.ts`): it compares the running version to the latest published
  release's `latest.yml`, downloads a newer one in the background, and installs it on
  next quit. It is a no-op in dev (`app.isPackaged` guard).

## Code signing (Windows)

The Windows installer is signed via **Azure Trusted Signing** during the release
build — configured in `desktop/package.json` → `build.win.azureSignOptions`
(endpoint `https://eus.codesigning.azure.net/`, account `ezmoney-signing`, profile
`EZMoneyCert`). electron-builder authenticates with a service principal via three
GitHub Actions secrets — `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
— and auto-installs the `TrustedSigning` PowerShell module on the runner. Signing
happens *before* `latest.yml` is generated, so the auto-update hashes stay valid.

The service principal (`ezmoney-github-releases`) holds the **Artifact Signing
Certificate Profile Signer** role on the signing account. If its secret is rotated,
update the `AZURE_CLIENT_SECRET` repo secret. Signing only runs on the Windows leg;
building a signed Windows installer **locally** requires those same env vars.

## Caveats

- **macOS** auto-update isn't supported (there's no signed mac build).
- **First signed release:** existing (unsigned) installs still auto-update normally;
  the SmartScreen "unknown publisher" warning goes away for the signed installer
  (reputation with SmartScreen may take a little time to fully build).
