/**
 * bookmarks-store.ts — Manipulation de l'arbre de favoris.
 * Toutes les fonctions sont pures : elles retournent un nouvel objet settings
 * sans modifier l'original (immutabilité).
 */

import type { BrowserSettings, BookmarkItem, BookmarkLink, BookmarkFolder } from './storage.js';

// ─── Helpers internes ────────────────────────────────────────────────────────

function hasUrl(items: BookmarkItem[], url: string): boolean {
  for (const item of items) {
    if (item.type === 'link' && item.url === url) return true;
    if (item.type === 'folder' && hasUrl(item.children, url)) return true;
  }
  return false;
}

function removeById(items: BookmarkItem[], id: string): BookmarkItem[] {
  return items.filter(i => i.id !== id)
    .map(i => i.type === 'folder' ? { ...i, children: removeById(i.children, id) } : i);
}

function renameById(items: BookmarkItem[], id: string, name: string): BookmarkItem[] {
  return items.map(i => {
    if (i.id === id) return i.type === 'link' ? { ...i, title: name } : { ...i, name };
    if (i.type === 'folder') return { ...i, children: renameById(i.children, id, name) };
    return i;
  });
}

function filterDups(items: BookmarkItem[], seen: Set<string>): BookmarkItem[] {
  return items.reduce<BookmarkItem[]>((acc, item) => {
    if (item.type === 'link') {
      if (!seen.has(item.url)) { seen.add(item.url); acc.push(item); }
    } else {
      const filtered = filterDups(item.children, seen);
      if (filtered.length > 0) acc.push({ ...item, children: filtered });
    }
    return acc;
  }, []);
}

function insertItem(
  items: BookmarkItem[], item: BookmarkItem, targetId: string,
  position: 'before' | 'after' | 'inside',
): BookmarkItem[] {
  if (position === 'inside') {
    return items.map(i => {
      if (i.id === targetId && i.type === 'folder') return { ...i, children: [...i.children, item] };
      if (i.type === 'folder') return { ...i, children: insertItem(i.children, item, targetId, position) };
      return i;
    });
  }
  const result: BookmarkItem[] = [];
  for (const i of items) {
    if (i.id === targetId) {
      if (position === 'before') { result.push(item); result.push(i); }
      else { result.push(i); result.push(item); }
    } else if (i.type === 'folder') {
      result.push({ ...i, children: insertItem(i.children, item, targetId, position) });
    } else result.push(i);
  }
  return result;
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Aplatit l'arbre en liste de liens uniquement. */
export function flattenBookmarks(items: BookmarkItem[]): BookmarkLink[] {
  const result: BookmarkLink[] = [];
  for (const item of items) {
    if (item.type === 'link') result.push(item);
    else result.push(...flattenBookmarks(item.children));
  }
  return result;
}

/** Compte les liens dans l'arbre (récursif). */
export function countBookmarkLinks(items: BookmarkItem[]): number {
  return items.reduce((n, i) => n + (i.type === 'link' ? 1 : countBookmarkLinks(i.children)), 0);
}

/** Trouve un lien par URL dans l'arbre. */
export function findBookmarkByUrl(items: BookmarkItem[], url: string): BookmarkLink | null {
  for (const item of items) {
    if (item.type === 'link' && item.url === url) return item;
    if (item.type === 'folder') { const f = findBookmarkByUrl(item.children, url); if (f) return f; }
  }
  return null;
}

/** Trouve un item (lien ou dossier) par ID. */
export function findBookmarkById(items: BookmarkItem[], id: string): BookmarkItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === 'folder') { const f = findBookmarkById(item.children, id); if (f) return f; }
  }
  return null;
}

export function isBookmarked(s: BrowserSettings, url: string): boolean {
  return hasUrl(s.bookmarks, url);
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

export function renameItem(s: BrowserSettings, id: string, name: string): BrowserSettings {
  return { ...s, bookmarks: renameById(s.bookmarks, id, name) };
}

export function mergeBookmarks(s: BrowserSettings, incoming: BookmarkItem[]): BrowserSettings {
  const existingUrls = new Set(flattenBookmarks(s.bookmarks).map(b => b.url));
  return { ...s, bookmarks: [...s.bookmarks, ...filterDups(incoming, existingUrls)] };
}

/** Extrait un item par ID, retourne [item, arbreRestant]. */
export function extractItem(items: BookmarkItem[], id: string): [BookmarkItem | null, BookmarkItem[]] {
  let extracted: BookmarkItem | null = null;
  const remaining: BookmarkItem[] = [];
  for (const item of items) {
    if (item.id === id) { extracted = item; }
    else if (item.type === 'folder') {
      const [found, newChildren] = extractItem(item.children, id);
      if (found) extracted = found;
      remaining.push({ ...item, children: newChildren });
    } else remaining.push(item);
  }
  return [extracted, remaining];
}

/** Déplace un item avant/après/dans un autre item de l'arbre. */
export function moveBookmark(
  s: BrowserSettings, itemId: string, targetId: string,
  position: 'before' | 'after' | 'inside',
): BrowserSettings {
  if (itemId === targetId) return s;
  const [item, withoutItem] = extractItem(s.bookmarks, itemId);
  if (!item) return s;
  return { ...s, bookmarks: insertItem(withoutItem, item, targetId, position) };
}

/** Retourne la liste à plat des dossiers avec leur chemin complet. */
export function getFlatFolders(
  items: BookmarkItem[], prefix = '',
): { id: string; name: string; path: string }[] {
  const result: { id: string; name: string; path: string }[] = [];
  for (const item of items) {
    if (item.type === 'folder') {
      const path = prefix ? `${prefix} / ${item.name}` : item.name;
      result.push({ id: item.id, name: item.name, path });
      result.push(...getFlatFolders(item.children, path));
    }
  }
  return result;
}
