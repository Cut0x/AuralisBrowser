import type { BrowserSettings, BookmarkItem, BookmarkLink, BookmarkFolder } from './storage.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function flattenBookmarks(items: BookmarkItem[]): BookmarkLink[] {
  const result: BookmarkLink[] = [];
  for (const item of items) {
    if (item.type === 'link') result.push(item);
    else result.push(...flattenBookmarks(item.children));
  }
  return result;
}

export function countBookmarkLinks(items: BookmarkItem[]): number {
  return items.reduce((n, i) => n + (i.type === 'link' ? 1 : countBookmarkLinks(i.children)), 0);
}

export function findBookmarkByUrl(items: BookmarkItem[], url: string): BookmarkLink | null {
  for (const item of items) {
    if (item.type === 'link' && item.url === url) return item;
    if (item.type === 'folder') { const f = findBookmarkByUrl(item.children, url); if (f) return f; }
  }
  return null;
}

export function findBookmarkById(items: BookmarkItem[], id: string): BookmarkItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === 'folder') { const f = findBookmarkById(item.children, id); if (f) return f; }
  }
  return null;
}

export function isBookmarked(s: BrowserSettings, url: string): boolean { return hasUrl(s.bookmarks, url); }

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
