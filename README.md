# Auralis Browser 1.0.0

Auralis is a desktop browser built with **Tauri 2 + Rust + TypeScript**.
This release introduces a rebuilt internal navigation model (`auralis:*`), a first-install onboarding flow, and a hardened WebView loading pipeline.

## Highlights

- Internal pages now use a unified scheme:
  - `auralis:home`
  - `auralis:settings`
  - `auralis:settings/apparence`
  - `auralis:settings/moteur`
  - `auralis:settings/demarrage`
  - `auralis:settings/favoris`
  - `auralis:settings/historique`
  - `auralis:settings/securite`
  - `auralis:settings/cache`
  - `auralis:settings/a-propos`
- New `auralis:home` page with a built-in product presentation.
- First installation behavior:
  - opens `http://localhost:3000/welcome.php` once,
  - then persists onboarding state locally.
- Better load reliability:
  - navigation state can now be resolved on both `content-navigated` and `content-loaded`,
  - avoids infinite spinner when start-navigation events are missed by platform WebView callbacks.
- Dedicated app console window with structured runtime logs.

## Project Structure

- `src/`
  - `main.ts`: app bootstrap, first-run flow, keyboard and UI bindings
  - `browser.ts`: tab/webview runtime orchestration
  - `browser-events.ts`: Tauri event bridge and navigation state updates
  - `search.ts`: smart URL/search resolution
  - `internal-pages.ts`: internal route parsing/normalization (`auralis:*`)
  - `ui-nav.ts`: internal/external navigation dispatcher
  - `ui-settings.ts`: internal pages rendering including `auralis:home`
  - `storage.ts`: persisted settings/history
- `src-tauri/`
  - `src/lib.rs`: Tauri bootstrap and command registration
  - `src/webview.rs`: child WebView lifecycle and navigation events
  - `src/console.rs`: in-app log buffer and console event streaming
  - `tauri.conf.json`: bundle/app metadata
- `public/`
  - `console.html`: dedicated log viewer window

## Requirements

- Node.js 20+
- Rust stable toolchain
- Tauri prerequisites for your OS

Windows installer metadata uses the app version from:
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

All are set to `1.0.0`.

## Development

Install dependencies:

```bash
npm install
```

Run frontend dev server only:

```bash
npm run dev
```

Run full Tauri app in dev mode:

```bash
npm run tauri:dev
```

Build frontend:

```bash
npm run build
```

Build the Windows installer (`setup.exe`):

```bash
npm run tauri:build
```

Output:

```text
src-tauri\target\release\bundle\nsis\Auralis_1.0.0_x64-setup.exe
```

The project is configured to bundle **NSIS setup.exe only** and includes WebView2 runtime installation during setup (`offlineInstaller` mode).

## First-Install Welcome Page

On first launch, Auralis opens:

```text
http://localhost:3000/welcome.php
```

The page file is expected at:

```text
C:\Users\Loïc\Documents\Projets\AuralisWebsite\welcome.php
```

If your local PHP server is not running on port `3000`, the page will not load.

## Internal Navigation Rules

- Inputs starting with legacy `auralis::` are normalized to `auralis:*`.
- `auralis:settings` resolves to `auralis:settings/apparence`.
- Internal pages are excluded from history entries.

## Troubleshooting

### Infinite loading indicator

If a page appears stuck loading:

1. Open the Auralis console window.
2. Check `content-navigated` / `content-loaded` events.
3. Confirm the target URL is reachable.

The runtime now applies a fallback from `content-loaded` to avoid spinner lock when the start event is skipped.

### App opens but no site can load

If navigation fails with no visible page, install Auralis using the generated `setup.exe` (not the raw `auralis.exe`).
The setup installer installs required WebView2 runtime automatically.

### MSI bundling errors on version format

MSI rejects non-numeric prerelease tags.
Use stable versions like `1.0.0` (current default) for Windows bundles.

## License

MIT
