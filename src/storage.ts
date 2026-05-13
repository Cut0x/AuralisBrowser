// Typed localStorage wrapper. Single source of truth for all persistent state.

import type { SavedPassword } from './passwords.js';
import type { Lang } from './i18n.js';

export type ThemeName    = 'dark' | 'light' | 'midnight';
export type SearchEngine = 'google' | 'duckduckgo' | 'brave' | 'startpage';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

export interface BrowserSettings {
  theme: ThemeName;
  searchEngine: SearchEngine;
  homepage: string;
  language: Lang;
  showFavoritesBar: boolean;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  passwords: SavedPassword[];
}

const KEY = 'auralis_v2';

const DEFAULTS: BrowserSettings = {
  theme:           'dark',
  searchEngine:    'duckduckgo',
  homepage:        'about:newtab',
  language:        'fr',
  showFavoritesBar: true,
  bookmarks:       [],
  history:         [],
  passwords:       [],
};

export function loadSettings(): BrowserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw) as Partial<BrowserSettings>;
    return {
      ...DEFAULTS, ...p,
      bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks : [],
      history:   Array.isArray(p.history)   ? p.history   : [],
      passwords: Array.isArray(p.passwords) ? p.passwords : [],
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: BrowserSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch (e) { console.error('[Auralis] save failed', e); }
}

export function addBookmark(s: BrowserSettings, title: string, url: string): BrowserSettings {
  if (s.bookmarks.some(b => b.url === url)) return s;
  const b: Bookmark = { id: crypto.randomUUID(), title, url, createdAt: Date.now() };
  return { ...s, bookmarks: [...s.bookmarks, b] };
}

export function removeBookmark(s: BrowserSettings, id: string): BrowserSettings {
  return { ...s, bookmarks: s.bookmarks.filter(b => b.id !== id) };
}

export function isBookmarked(s: BrowserSettings, url: string): boolean {
  return s.bookmarks.some(b => b.url === url);
}

export function mergeBookmarks(s: BrowserSettings, incoming: Omit<Bookmark, 'id' | 'createdAt'>[]): BrowserSettings {
  const existing = new Set(s.bookmarks.map(b => b.url));
  const toAdd: Bookmark[] = incoming
    .filter(b => !existing.has(b.url))
    .map(b => ({ id: crypto.randomUUID(), title: b.title, url: b.url, createdAt: Date.now() }));
  return { ...s, bookmarks: [...s.bookmarks, ...toAdd] };
}

export function addHistoryEntry(s: BrowserSettings, title: string, url: string): BrowserSettings {
  if (!url || url === 'about:newtab') return s;
  const e: HistoryEntry = { id: crypto.randomUUID(), title, url, visitedAt: Date.now() };
  return { ...s, history: [e, ...s.history].slice(0, 1000) };
}
