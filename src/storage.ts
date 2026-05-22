/**
 * storage.ts — Persistence via localStorage.
 * Types, valeurs par défaut, chargement et sauvegarde des paramètres.
 * Les fonctions de manipulation des favoris sont dans bookmarks-store.ts.
 */

import type { SavedPassword } from './passwords.js';
import type { Lang }          from './i18n.js';

export type ThemeName    = 'dark' | 'light' | 'midnight';
export type SearchEngine = 'google' | 'duckduckgo' | 'brave' | 'startpage';

export interface BookmarkLink {
  id: string; type: 'link';
  title: string; url: string; createdAt: number;
}

export interface BookmarkFolder {
  id: string; type: 'folder';
  name: string; children: BookmarkItem[]; createdAt: number;
}

export type BookmarkItem = BookmarkLink | BookmarkFolder;

export interface HistoryEntry {
  id: string; title: string; url: string; visitedAt: number;
}

export interface BrowserSettings {
  theme:            ThemeName;
  searchEngine:     SearchEngine;
  homepage:         string;
  language:         Lang;
  showFavoritesBar: boolean;
  bookmarks:        BookmarkItem[];
  history:          HistoryEntry[];
  passwords:        SavedPassword[];
}

const KEY = 'auralis_v2';

const DEFAULTS: BrowserSettings = {
  theme: 'dark', searchEngine: 'duckduckgo', homepage: 'auralis:home',
  language: 'fr', showFavoritesBar: true,
  bookmarks: [], history: [], passwords: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateBookmarks(raw: any[]): BookmarkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    if (item?.type === 'folder') {
      return { id: item.id ?? crypto.randomUUID(), type: 'folder' as const,
        name: item.name ?? 'Dossier', children: migrateBookmarks(item.children ?? []),
        createdAt: item.createdAt ?? Date.now() };
    }
    return { id: item.id ?? crypto.randomUUID(), type: 'link' as const,
      title: item.title ?? item.url ?? '', url: item.url ?? '',
      createdAt: item.createdAt ?? Date.now() };
  });
}

/** Charge les paramètres depuis localStorage (avec migration et valeurs par défaut). */
export function loadSettings(): BrowserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = JSON.parse(raw) as any;
    const homepage = typeof p.homepage === 'string' ? p.homepage : DEFAULTS.homepage;
    const normalizedHomepage = homepage.startsWith('auralis::')
      ? homepage.replace(/^auralis::/, 'auralis:')
      : homepage;
    return { ...DEFAULTS, ...p,
      homepage: normalizedHomepage,
      bookmarks: migrateBookmarks(Array.isArray(p.bookmarks) ? p.bookmarks : []),
      history:   Array.isArray(p.history)   ? p.history   : [],
      passwords: Array.isArray(p.passwords) ? p.passwords : [],
    };
  } catch { return structuredClone(DEFAULTS); }
}

/** Sérialise et sauvegarde les paramètres en localStorage. */
export function saveSettings(s: BrowserSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch (e) { console.error('[Auralis] sauvegarde échouée', e); }
}

/** Ajoute une entrée en tête d'historique (max 1000). */
export function addHistoryEntry(s: BrowserSettings, title: string, url: string): BrowserSettings {
  if (!url || url === 'about:newtab') return s;
  if (url.startsWith('auralis:')) return s;
  const e: HistoryEntry = { id: crypto.randomUUID(), title, url, visitedAt: Date.now() };
  return { ...s, history: [e, ...s.history].slice(0, 1000) };
}

/** Calcule l'espace localStorage utilisé et le quota estimé. */
export function getLocalStorageSize(): { used: number; quota: number } {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    used += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
  }
  return { used, quota: 5 * 1024 * 1024 };
}
