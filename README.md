# Auralis Browser 1.0.0

Auralis est un navigateur desktop construit avec Tauri 2, Rust et TypeScript.
Cette version inclut la navigation interne `auralis:*`, le demarrage de bienvenue et un moteur WebView stabilise.

## Fonctionnalites principales

- Routes internes unifiees:
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
- Page d'accueil interne `auralis:home`.
- Premiere ouverture redirigee vers `https://auralisbrowser.fr/welcome`.
- Console Auralis disponible au clic droit via l'entree `Console Auralis`.
- Fenetre console cachee par defaut au lancement.

## Architecture

- `src/`
  - `main.ts`: bootstrap, evenements UI, menu contextuel
  - `browser.ts`: orchestration WebView et navigation
  - `browser-events.ts`: ecoute des evenements Tauri
  - `internal-pages.ts`: parsing/normalisation des routes `auralis:*`
  - `ui-settings.ts`: rendu des pages internes
- `src-tauri/`
  - `src/lib.rs`: initialisation Tauri et commandes Rust
  - `src/webview.rs`: WebView de contenu unique et events de navigation
  - `src/console.rs`: buffer de logs applicatifs
  - `tauri.conf.json`: metadata et bundle Windows
- `public/`
  - `console.html`: interface de consultation des logs

## Prerequis

- Node.js 20+
- Rust stable
- Prerequis Tauri pour votre OS

## Developpement

Installer les dependances:

```bash
npm install
```

Lancer le frontend en dev:

```bash
npm run dev
```

Lancer l'application Tauri en dev:

```bash
npm run tauri:dev
```

Build frontend:

```bash
npm run build
```

Build installateur Windows:

```bash
npm run tauri:build
```

Sortie:

```text
src-tauri\target\release\bundle\nsis\Auralis_1.0.0_x64-setup.exe
```

## Installation Windows

Utiliser le `setup.exe` genere.
L'installateur NSIS gere l'installation de WebView2 en mode `offlineInstaller`.

## Liens officiels

- Site: `https://auralisbrowser.fr`
- Welcome: `https://auralisbrowser.fr/welcome`
- GitHub: `https://github.com/Cut0x/AuralisBrowser`

## Depannage

Si la navigation ne charge pas:

1. Ouvrir le menu clic droit dans l'interface.
2. Cliquer `Console Auralis`.
3. Verifier les erreurs de navigation/webview dans la console.

## Licence

MIT
