import type { BrowserSettings, BookmarkItem } from './storage.js';

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

export function moveBookmark(
  s: BrowserSettings, itemId: string, targetId: string,
  position: 'before' | 'after' | 'inside',
): BrowserSettings {
  if (itemId === targetId) return s;
  const [item, withoutItem] = extractItem(s.bookmarks, itemId);
  if (!item) return s;
  return { ...s, bookmarks: insertItem(withoutItem, item, targetId, position) };
}

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
