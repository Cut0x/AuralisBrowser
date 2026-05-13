// Internationalisation — FR / EN.
// All UI strings live here. Call t(key) after setLang(lang).

export type Lang = 'fr' | 'en';

const STRINGS: Record<Lang, Record<string, string>> = {
  fr: {
    /* New tab */
    'newtab.tagline':         'Un navigateur beau, léger et entièrement personnalisable.',
    'newtab.search':          'Rechercher sur le web…',
    'newtab.no_bookmarks':    'Pas encore de favoris — naviguez vers une page et cliquez sur ☆.',
    /* Topbar */
    'tab.new':                'Nouvel onglet',
    'tab.new_title':          'Nouvel onglet (Ctrl+T)',
    /* Navbar */
    'nav.back':               'Précédent (Alt+←)',
    'nav.forward':            'Suivant (Alt+→)',
    'nav.reload':             'Recharger (Ctrl+R)',
    'nav.urlbar':             'Rechercher ou entrer une adresse…',
    'nav.bookmark_add':       'Ajouter aux favoris',
    'nav.bookmark_remove':    'Retirer des favoris',
    'nav.settings':           'Paramètres',
    'nav.passwords':          'Mots de passe',
    /* Favorites bar */
    'favbar.import':          'Importer',
    'favbar.import_title':    'Importer les favoris (Chrome/Firefox HTML)',
    /* Settings */
    'settings.title':         'Paramètres',
    'settings.appearance':    'Apparence',
    'settings.theme':         'Thème',
    'settings.theme_dark':    'Sombre — Aurora',
    'settings.theme_light':   'Clair — Brume',
    'settings.theme_midnight':'Minuit',
    'settings.language':      'Langue',
    'settings.search':        'Moteur de recherche',
    'settings.engine':        'Moteur par défaut',
    'settings.homepage':      'Page d\'accueil',
    'settings.homepage_url':  'URL de démarrage',
    'settings.favbar':        'Afficher la barre des favoris',
    'settings.bookmarks':     'Favoris',
    'settings.import_btn':    'Importer (HTML Chrome/Firefox)',
    'settings.export_btn':    'Exporter',
    'settings.passwords':     'Mots de passe',
    'settings.passwords_hint':'Les mots de passe sont chiffrés localement.',
    'settings.shortcuts':     'Raccourcis clavier',
    'settings.about':         'À propos',
    'settings.save':          'Enregistrer',
    'settings.cancel':        'Annuler',
    /* Passwords */
    'pw.save_prompt':         'Enregistrer le mot de passe pour ce site ?',
    'pw.username':            'Identifiant',
    'pw.password':            'Mot de passe',
    'pw.save':                'Enregistrer',
    'pw.fill':                'Copier',
    'pw.delete':              'Supprimer',
    'pw.no_saved':            'Aucun mot de passe enregistré.',
    'pw.domain':              'Domaine',
    /* Blocked page */
    'blocked.title':          'Impossible d\'afficher cette page ici',
    'blocked.desc':           'Ce site bloque l\'intégration. Ouvrez-le dans votre navigateur système.',
    'blocked.open':           'Ouvrir dans le navigateur système',
    /* Toasts */
    'toast.bookmark_added':   'Favori ajouté',
    'toast.bookmark_removed': 'Favori supprimé',
    'toast.settings_saved':   'Paramètres enregistrés',
    'toast.pw_saved':         'Mot de passe enregistré',
    'toast.pw_deleted':       'Mot de passe supprimé',
    'toast.copied':           'Copié dans le presse-papiers',
    'toast.imported':         'Favoris importés',
    /* About */
    'about.desc':             'Un navigateur beau, léger et personnalisable.',
    'about.stack':            'Tauri · Rust · TypeScript',
    'about.license':          'Licence MIT',
  },

  en: {
    'newtab.tagline':         'A beautiful, lightweight and fully customizable browser.',
    'newtab.search':          'Search the web…',
    'newtab.no_bookmarks':    'No bookmarks yet — browse to a page and click ☆ to save.',
    'tab.new':                'New Tab',
    'tab.new_title':          'New Tab (Ctrl+T)',
    'nav.back':               'Back (Alt+←)',
    'nav.forward':            'Forward (Alt+→)',
    'nav.reload':             'Reload (Ctrl+R)',
    'nav.urlbar':             'Search or enter address…',
    'nav.bookmark_add':       'Add to bookmarks',
    'nav.bookmark_remove':    'Remove bookmark',
    'nav.settings':           'Settings',
    'nav.passwords':          'Passwords',
    'favbar.import':          'Import',
    'favbar.import_title':    'Import bookmarks (Chrome/Firefox HTML)',
    'settings.title':         'Settings',
    'settings.appearance':    'Appearance',
    'settings.theme':         'Theme',
    'settings.theme_dark':    'Dark — Aurora',
    'settings.theme_light':   'Light — Mist',
    'settings.theme_midnight':'Midnight',
    'settings.language':      'Language',
    'settings.search':        'Search Engine',
    'settings.engine':        'Default engine',
    'settings.homepage':      'Homepage',
    'settings.homepage_url':  'Startup URL',
    'settings.favbar':        'Show favorites bar',
    'settings.bookmarks':     'Bookmarks',
    'settings.import_btn':    'Import (Chrome/Firefox HTML)',
    'settings.export_btn':    'Export',
    'settings.passwords':     'Passwords',
    'settings.passwords_hint':'Passwords are encrypted locally.',
    'settings.shortcuts':     'Keyboard shortcuts',
    'settings.about':         'About',
    'settings.save':          'Save',
    'settings.cancel':        'Cancel',
    'pw.save_prompt':         'Save password for this site?',
    'pw.username':            'Username',
    'pw.password':            'Password',
    'pw.save':                'Save',
    'pw.fill':                'Copy',
    'pw.delete':              'Delete',
    'pw.no_saved':            'No saved passwords.',
    'pw.domain':              'Domain',
    'blocked.title':          'Cannot display this page here',
    'blocked.desc':           'This site blocks embedding. Open it in your system browser.',
    'blocked.open':           'Open in system browser',
    'toast.bookmark_added':   'Bookmark added',
    'toast.bookmark_removed': 'Bookmark removed',
    'toast.settings_saved':   'Settings saved',
    'toast.pw_saved':         'Password saved',
    'toast.pw_deleted':       'Password deleted',
    'toast.copied':           'Copied to clipboard',
    'toast.imported':         'Bookmarks imported',
    'about.desc':             'A beautiful, lightweight and customizable browser.',
    'about.stack':            'Tauri · Rust · TypeScript',
    'about.license':          'MIT License',
  },
};

let _lang: Lang = 'en';

export function setLang(lang: Lang): void {
  _lang = lang;
  applyAll();
}

export function getLang(): Lang {
  return _lang;
}

export function t(key: string): string {
  return STRINGS[_lang][key] ?? STRINGS['en'][key] ?? key;
}

/** Update every element with data-i18n and data-i18n-placeholder in the DOM. */
export function applyAll(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n!;
    el.textContent = t(key);
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle!);
  });
}
