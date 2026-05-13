# Auralis

**A beautiful, lightweight and fully customizable browser.**

Built with Tauri + Rust + TypeScript. No Electron. No bloat. Just a fast, artistic, premium browsing experience.

---

## Philosophy

Auralis was born from a simple conviction: a browser should be beautiful **and** lightweight. Modern browsers consume gigabytes of RAM, run dozens of background processes, and offer zero visual identity.

Auralis is the opposite. It uses the **system's native WebView** (WebView2 on Windows, WebKit on macOS/Linux) through Tauri, meaning the rendering engine is already loaded by the OS. Auralis itself barely adds anything on top — just a clean, glassmorphic shell around it.

The visual identity draws from Japanese fantasy landscapes: mist, deep purple skies, soft gold light, and the kind of calm beauty you feel in a painting.

---

## Performance Goals

| Metric | Target |
|--------|--------|
| RAM usage (idle) | < 80 MB |
| RAM usage (1 tab) | < 120 MB |
| Startup time | < 500 ms |
| CPU idle | ~0% |
| Binary size | < 15 MB |

These targets are achievable because:
- Tauri uses the system WebView (no bundled Chromium)
- The frontend is vanilla TypeScript + CSS (no React, no Vue)
- No unnecessary background polling or timers
- Minimal IPC calls between Rust and JS

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Backend | Rust |
| Frontend | TypeScript (vanilla) |
| Bundler | Vite |
| Styling | CSS custom properties + Glassmorphism |
| Storage | localStorage (settings, bookmarks, history) |
| WebView | System native (WebView2 / WebKit) |

---

## Prerequisites

Before installing, make sure you have:

- **Node.js** v18 or later — https://nodejs.org
- **Rust** (stable toolchain) — https://rustup.rs
- **Tauri CLI prerequisites** for your OS:
  - **Windows**: WebView2 (included in Windows 11, or download the bootstrapper)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: See https://tauri.app/start/prerequisites/

Verify your setup:
```bash
node --version
rustc --version
cargo --version
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/auralis.git
cd auralis

# Install JavaScript dependencies
npm install
```

---

## Development

Start the development server with hot-reload:

```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Open the Auralis window

Changes to TypeScript/CSS files reload instantly. Changes to Rust files trigger a Rust recompile.

---

## Build & Compile

Compile a production build:

```bash
npm run tauri build
```

This generates optimized bundles for your platform in `src-tauri/target/release/bundle/`.

### Windows Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/msi/Auralis_0.1.0_x64_en-US.msi`
Also produces a portable `.exe` in `src-tauri/target/release/`.

### macOS Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/macos/Auralis.app`
Also produces a `.dmg` installer.

### Linux Build

```bash
npm run tauri build
```

Output: `.deb`, `.rpm`, and `.AppImage` depending on your distro.

---

## Tab System

Auralis implements a lightweight tab system entirely in TypeScript:

- Each tab has: `id`, `title`, `url`, `favicon`, `isLoading`, `canGoBack`, `canGoForward`
- Tabs are managed by `TabManager` in `src/tabs.ts`
- The active tab drives the URL bar and navigation state
- Closing the last tab automatically creates a new one
- Tab state is kept in memory (not persisted between sessions, by design)

---

## Search Engines

| Engine | Keyword |
|--------|---------|
| DuckDuckGo | Default |
| Google | `google` |
| Brave Search | `brave` |
| Startpage | `startpage` |

The URL bar is "smart": if you type a full URL it navigates directly. If you type anything else, it searches with your default engine.

To change your default engine: **Settings → Search Engine**.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+L` | Focus URL bar |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+R` | Reload page |
| `Alt+←` | Go back |
| `Alt+→` | Go forward |

---

## Theme Customization

Auralis ships with three themes:

| Theme | Description |
|-------|-------------|
| **Dark (Aurora)** | Deep purple-black with rose/violet accents |
| **Light (Mist)** | Soft lavender whites, airy and clean |
| **Midnight** | Near-black with ultra-subtle glows |

Themes are defined as CSS custom properties in `src/styles/theme.css`. To create a new theme:

1. Add a `[data-theme="yourtheme"]` block in `theme.css`
2. Override the CSS variables
3. Add the option in `src/settings.ts` and `index.html`

---

## File Structure

```
auralis/
├── README.md                    # This file
├── LICENSE                      # MIT license
├── package.json                 # npm scripts and dependencies
├── vite.config.ts               # Vite bundler configuration
├── tsconfig.json                # TypeScript compiler options
├── index.html                   # Main HTML shell (browser chrome)
├── public/
│   └── auralis.svg              # App favicon
├── src/
│   ├── main.ts                  # App entry point, wires all modules
│   ├── browser.ts               # WebView/iframe navigation engine
│   ├── tabs.ts                  # Tab management (create/close/switch)
│   ├── settings.ts              # Settings panel controller
│   ├── storage.ts               # localStorage wrapper (settings/bookmarks)
│   ├── search.ts                # URL resolution and search engine logic
│   ├── ui.ts                    # DOM utilities, theme, notifications
│   ├── styles/
│   │   ├── theme.css            # CSS custom properties for all themes
│   │   ├── glass.css            # Glassmorphism utility classes
│   │   └── main.css             # Full application layout and components
│   └── assets/
│       └── bg.svg               # Decorative background asset
└── src-tauri/
    ├── Cargo.toml               # Rust dependencies
    ├── build.rs                 # Tauri build script
    ├── tauri.conf.json          # Tauri window and app configuration
    ├── capabilities/
    │   └── default.json         # Tauri permission declarations
    └── src/
        ├── main.rs              # Rust entry point
        └── lib.rs               # Tauri commands and setup
```

---

## Roadmap

- [x] Tab system
- [x] URL bar with smart search
- [x] Glassmorphic UI
- [x] Bookmarks
- [x] History
- [x] Settings panel
- [x] Multiple themes
- [x] Keyboard shortcuts
- [ ] Bookmark manager page
- [ ] Full history viewer
- [ ] Per-tab zoom control
- [ ] Find in page (Ctrl+F)
- [ ] Download manager
- [ ] Extensions API
- [ ] Custom CSS injection
- [ ] Picture-in-picture
- [ ] Privacy mode (no history)
- [ ] Sync across devices (optional, self-hosted)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

**Code style guidelines:**
- TypeScript: strict mode, no `any`, minimal comments
- Rust: idiomatic Rust, `clippy`-clean
- CSS: BEM-ish naming, CSS variables for theming
- No framework dependencies on the frontend

```bash
# Lint TypeScript
npx tsc --noEmit

# Lint Rust
cargo clippy --manifest-path src-tauri/Cargo.toml
```

---

## Security

- Auralis uses Tauri's strict CSP and permission system
- No remote code execution via IPC
- Bookmarks and history are stored locally only
- No telemetry, no analytics, no cloud sync by default
- The iframe sandbox attribute limits what embedded pages can do

**Report security vulnerabilities** by opening a GitHub issue marked `[SECURITY]`.

---

## License

MIT © Auralis Contributors

See [LICENSE](./LICENSE) for the full text.
