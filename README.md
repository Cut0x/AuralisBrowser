# Auralis

**Auralis** est un navigateur web moderne, beau et ultra-léger, propulsé par [Tauri](https://tauri.app/) et Rust. Aucun Chromium embarqué — il utilise le moteur WebView2 natif de Windows.

## Fonctionnalités

- **Ultra léger** — Moins de 80 Mo de RAM au démarrage, lancement en moins de 500 ms, ~0 % CPU au repos
- **WebView2 natif** — Pas de Chromium bundle, juste le moteur système Windows
- **Design glassmorphique** — 3 thèmes : Aurora (sombre), Brume (beige chaleureux), Minuit
- **Multi-onglets** — Gestion complète des onglets avec navigation par historique
- **Favoris avec dossiers** — Import/export Chrome & Firefox, organisation en dossiers imbriqués
- **Liens `target="_blank"`** — Ouverts automatiquement dans un nouvel onglet, exactement comme Chrome
- **Paramètres en pages** — Navigation via `auralis::settings` et ses sous-pages
- **Mots de passe chiffrés** — AES-GCM 256 bits local, jamais transmis sur le réseau
- **Multi-moteurs** — DuckDuckGo, Google, Brave Search, Startpage
- **Bilingue** — Interface disponible en français et en anglais

## Installation

### Programme d'installation (recommandé)

1. Téléchargez `Auralis_0.2.0_x64-setup.exe` depuis les [releases](https://cut0x.github.io/AuralisBrowser/download.html)
2. Lancez l'installeur et suivez les instructions
3. Profitez d'Auralis !

### Depuis les sources

**Prérequis :** Node.js 18+, Rust 1.77+, WebView2 Runtime (Windows)

```bash
git clone https://github.com/Cut0x/AuralisBrowser
cd AuralisBrowser
npm install
npm run tauri build
```

## Développement

```bash
npm run tauri dev
```

L'application se lance avec le rechargement à chaud pour le frontend TypeScript.

## Architecture

```
Auralis/
├── src/                     # Interface TypeScript (chrome du navigateur)
│   ├── main.ts              # Point d'entrée — bootstrap et événements
│   ├── browser.ts           # Moteur de navigation (WebView2 natif)
│   ├── storage.ts           # Persistance — favoris avec dossiers, historique, mots de passe
│   ├── tabs.ts              # Gestionnaire d'onglets
│   ├── import.ts            # Import/export de favoris (format Netscape + dossiers)
│   ├── passwords.ts         # Chiffrement AES-GCM
│   ├── i18n.ts              # Internationalisation FR/EN
│   ├── search.ts            # Résolution d'URL et moteurs de recherche
│   └── styles/
│       ├── theme.css        # Tokens de design — 3 thèmes
│       ├── glass.css        # Utilitaires glassmorphisme
│       └── main.css         # Layout complet du navigateur
├── src-tauri/               # Backend Rust (Tauri v2)
│   ├── Cargo.toml
│   └── src/lib.rs           # Commandes Tauri, WebView enfant natif
├── docs/                    # Site de présentation
└── index.html               # Interface principale du navigateur
```

## Pages internes

Auralis propose un système de pages internes accessibles depuis la barre d'adresse :

| URL | Description |
|-----|-------------|
| `auralis::settings` | Page principale des paramètres |
| `auralis::settings/apparence` | Thème, langue, barre des favoris |
| `auralis::settings/moteur` | Moteur de recherche et page d'accueil |
| `auralis::settings/favoris` | Gestion des favoris et dossiers |
| `auralis::settings/historique` | Historique de navigation |
| `auralis::settings/securite` | Mots de passe chiffrés |
| `auralis::settings/cache` | Vider les données de navigation |
| `auralis::settings/a-propos` | Informations sur Auralis |

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+L` | Focaliser la barre d'adresse |
| `Ctrl+T` | Nouvel onglet |
| `Ctrl+W` | Fermer l'onglet actif |
| `Ctrl+R` | Recharger la page |
| `Alt+←` | Page précédente |
| `Alt+→` | Page suivante |

## Sécurité

- Les mots de passe sont chiffrés localement via **AES-GCM 256 bits** avant stockage
- La clé de chiffrement est générée par le navigateur et stockée localement
- Aucune donnée n'est transmise à des serveurs tiers
- Le navigateur n'embarque aucun code de télémétrie

## Performances

| Métrique | Objectif |
|----------|---------|
| RAM au repos | < 80 Mo |
| RAM (1 onglet) | < 120 Mo |
| Démarrage | < 500 ms |
| CPU au repos | ~0 % |
| Taille du binaire | < 15 Mo |

## Licence

MIT © 2026 Auralis Contributors
