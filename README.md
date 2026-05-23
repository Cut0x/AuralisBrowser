# Auralis Browser 1.2.0

Auralis est un navigateur desktop construit avec Tauri 2, Rust et TypeScript.
Cette version inclut la navigation interne `auralis:*`, la page d'accueil `auralis:home` et un moteur WebView stabilisé.

## Fonctionnalités principales

- Routes internes unifiées :
  - `auralis:home`
  - `auralis:settings`
  - `auralis:settings/apparence`
  - `auralis:settings/moteur`
  - `auralis:settings/démarrage`
  - `auralis:settings/favoris`
  - `auralis:settings/historique`
  - `auralis:settings/sécurité`
  - `auralis:settings/cache`
  - `auralis:settings/à-propos`
- Page `auralis:home` orientée "internet" :
  - logo + marque Auralis
  - barre de recherche
  - deals jeux vidéo intégrés en direct
- Première ouverture redirigée vers `https://auralisbrowser.fr/welcome`.
- Console Auralis disponible au clic droit via l'entrée `Console Auralis`.
- Fenêtre console cachée par défaut au lancement.

## API externe utilisée

- CheapShark API :
  - endpoint deals : `https://www.cheapshark.com/api/1.0/deals`
  - utilisée pour alimenter les deals affichés sur `auralis:home`
- Au clic sur un deal, Auralis résout l'URL finale marchand côté Rust avant navigation, afin d'ouvrir directement la destination finale (Steam ou autre store) quand possible.

## Architecture

- `src/`
  - `main.ts` : bootstrap, événements UI, menu contextuel
  - `browser.ts` : orchestration WebView et navigation
  - `browser-events.ts` : écoute des événements Tauri
  - `internal-pages.ts` : parsing et normalisation des routes `auralis:*`
  - `ui-settings.ts` : rendu des pages internes (`auralis:home`, `auralis:settings/*`)
- `src-tauri/`
  - `src/lib.rs` : initialisation Tauri et commandes Rust
  - `src/webview.rs` : WebView de contenu unique et événements de navigation
  - `src/console.rs` : buffer de logs applicatifs
  - `tauri.conf.json` : métadonnées et bundle Windows
- `public/`
  - `console.html` : interface de consultation des logs

## Prérequis

- Node.js 20+
- Rust stable
- Prérequis Tauri pour votre OS

## Développement

Installer les dépendances :

```bash
npm install
```

Lancer le frontend en dev :

```bash
npm run dev
```

Lancer l'application Tauri en dev :

```bash
npm run tauri:dev
```

Build frontend :

```bash
npm run build
```

Build installateur Windows :

```bash
npm run tauri:build
```

Sortie :

```text
src-tauri\target\release\bundle\nsis\Auralis_1.2.0-beta_x64-setup.exe
```

## Installation Windows

Utiliser le `setup.exe` généré.
L'installateur NSIS gère l'installation de WebView2 en mode `offlineInstaller`.

## Liens officiels

- Site : `https://auralisbrowser.fr`
- Welcome : `https://auralisbrowser.fr/welcome`
- GitHub : `https://github.com/Cut0x/AuralisBrowser`

## Dépannage

Si la navigation ne charge pas :

1. Ouvrir le menu clic droit dans l'interface.
2. Cliquer `Console Auralis`.
3. Vérifier les erreurs de navigation WebView dans la console.

## Licence

MIT
