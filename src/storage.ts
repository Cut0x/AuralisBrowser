// Typed localStorage wrapper. Single source of truth for all persistent state.

import type { SavedPassword } from './passwords.js';
import type { Lang } from './i18n.js';

export type ThemeName    = 'dark' | 'light' | 'midnight';
export type SearchEngine = 'google' | 'duckduckgo' | 'brave' | 'startpage';

export interface BookmarkLink {
  id: string;
  type: 'link';
  title: string;
  url: string;
  createdAt: number;
}

export interface BookmarkFolder {
  id: string;
  type: 'folder';
  name: string;
  children: BookmarkItem[];
  createdAt: number;
}

export type BookmarkItem = BookmarkLink | BookmarkFolder;

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
  bookmarks: BookmarkItem[];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateBookmarks(raw: any[]): BookmarkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    if (item && item.type === 'folder') {
      return {
        id: item.id ?? crypto.randomUUID(),
        type: 'folder' as const,
        name: item.name ?? 'Dossier',
        children: migrateBookmarks(item.children ?? []),
        createdAt: item.createdAt ?? Date.now(),
      };
    }
    return {
      id: item.id ?? crypto.randomUUID(),
      type: 'link' as const,
      title: item.title ?? item.url ?? '',
      url: item.url ?? '',
      createdAt: item.createdAt ?? Date.now(),
    };
  });
}

export function loadSettings(): BrowserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = JSON.parse(raw) as any;
    return {
      ...DEFAULTS, ...p,
      bookmarks: migrateBookmarks(Array.isArray(p.bookmarks) ? p.bookmarks : []),
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

// ─── Bookmark helpers ────────────────────────────────────────────────────────

function hasUrl(items: BookmarkItem[], url: string): boolean {
  for (const item of items) {
    if (item.type === 'link' && item.url === url) return true;
    if (item.type === 'folder' && hasUrl(item.children, url)) return true;
  }
  return false;
}

function removeById(items: BookmarkItem[], id: string): BookmarkItem[] {
  return items
    .filter(item => item.id !== id)
    .map(item => item.type === 'folder'
      ? { ...item, children: removeById(item.children, id) }
      : item
    );
}

function renameById(items: BookmarkItem[], id: string, newName: string): BookmarkItem[] {
  return items.map(item => {
    if (item.id === id) {
      if (item.type === 'link')   return { ...item, title: newName };
      if (item.type === 'folder') return { ...item, name:  newName };
    }
    if (item.type === 'folder') return { ...item, children: renameById(item.children, id, newName) };
    return item;
  });
}

export function flattenBookmarks(items: BookmarkItem[]): BookmarkLink[] {
  const result: BookmarkLink[] = [];
  for (const item of items) {
    if (item.type === 'link') result.push(item);
    else result.push(...flattenBookmarks(item.children));
  }
  return result;
}

export function countBookmarkLinks(items: BookmarkItem[]): number {
  return items.reduce((n, item) =>
    n + (item.type === 'link' ? 1 : countBookmarkLinks(item.children)), 0);
}

export function findBookmarkByUrl(items: BookmarkItem[], url: string): BookmarkLink | null {
  for (const item of items) {
    if (item.type === 'link' && item.url === url) return item;
    if (item.type === 'folder') {
      const found = findBookmarkByUrl(item.children, url);
      if (found) return found;
    }
  }
  return null;
}

export function addBookmark(s: BrowserSettings, title: string, url: string): BrowserSettings {
  if (isBookmarked(s, url)) return s;
  const b: BookmarkLink = { id: crypto.randomUUID(), type: 'link', title, url, createdAt: Date.now() };
  return { ...s, bookmarks: [...s.bookmarks, b] };
}

export function addFolder(s: BrowserSettings, name: string): BrowserSettings {
  const f: BookmarkFolder = { id: crypto.randomUUID(), type: 'folder', name, children: [], createdAt: Date.now() };
  return { ...s, bookmarks: [...s.bookmarks, f] };
}

export function removeBookmark(s: BrowserSettings, id: string): BrowserSettings {
  return { ...s, bookmarks: removeById(s.bookmarks, id) };
}

export function renameItem(s: BrowserSettings, id: string, newName: string): BrowserSettings {
  return { ...s, bookmarks: renameById(s.bookmarks, id, newName) };
}

export function isBookmarked(s: BrowserSettings, url: string): boolean {
  return hasUrl(s.bookmarks, url);
}

function filterDuplicateLinks(items: BookmarkItem[], existing: Set<string>): BookmarkItem[] {
  return items.reduce<BookmarkItem[]>((acc, item) => {
    if (item.type === 'link') {
      if (!existing.has(item.url)) { existing.add(item.url); acc.push(item); }
    } else {
      const filtered = filterDuplicateLinks(item.children, existing);
      if (filtered.length > 0) acc.push({ ...item, children: filtered });
    }
    return acc;
  }, []);
}

export function mergeBookmarks(s: BrowserSettings, incoming: BookmarkItem[]): BrowserSettings {
  const existingUrls = new Set(flattenBookmarks(s.bookmarks).map(b => b.url));
  const toAdd = filterDuplicateLinks(incoming, existingUrls);
  return { ...s, bookmarks: [...s.bookmarks, ...toAdd] };
}

export function addHistoryEntry(s: BrowserSettings, title: string, url: string): BrowserSettings {
  if (!url || url === 'about:newtab') return s;
  const e: HistoryEntry = { id: crypto.randomUUID(), title, url, visitedAt: Date.now() };
  return { ...s, history: [e, ...s.history].slice(0, 1000) };
}
