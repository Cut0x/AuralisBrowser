import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { settings }                         from './state.js';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { navigate }                          from './ui-nav.js';
import { showCtxMenu }                       from './ui-ctx-menu.js';
import { attachFavbarDrag }                  from './ui-favbar-drag.js';
import type { BookmarkItem, BookmarkFolder } from './storage.js';

let currentAnchor:  HTMLElement | null = null;
let nativePopupOpen = false;
let lastClosedFolderId: string | null = null;
let lastClosedAt = 0;
const REOPEN_GUARD_MS = 160;

type PopupRow =
  | { kind: 'folder'; name: string; depth: number }
  | { kind: 'link'; title: string; url: string; depth: number };

function onGlobalPointerDown(e: PointerEvent): void {
  const t = e.target as Node | null;
  if (!nativePopupOpen) return;
  if (t && currentAnchor && currentAnchor.contains(t)) return;
  closeFolderPopover();
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && nativePopupOpen) closeFolderPopover();
}

export function renderFavBar(): void {
  const favBar    = document.getElementById('favorites-bar')!;
  const importBtn = document.getElementById('btn-favbar-import')!;
  Array.from(favBar.querySelectorAll('.favbar-item, .favbar-folder')).forEach(el => el.remove());

  for (const item of settings.bookmarks.slice(0, 16)) {
    const btn = document.createElement('button');
    btn.dataset.bmId = item.id;
    btn.setAttribute('data-tauri-drag-region', 'false');
    if (item.type === 'folder') {
      btn.className = 'favbar-folder'; btn.title = item.name;
      btn.innerHTML = `<svg class="favbar-favicon" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".45"/></svg><span class="favbar-label">${truncate(item.name, 16)}</span><svg class="favbar-folder-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 3.5L4.5 6 7 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
      btn.addEventListener('click', e => { e.stopPropagation(); showFolderPopover(item, btn); });
      btn.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    } else {
      btn.className = 'favbar-item'; btn.title = item.title;
      btn.innerHTML = `<img class="favbar-favicon" src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"><span class="favbar-label">${truncate(item.title, 16)}</span>`;
      btn.addEventListener('click', () => navigate(item.url));
      btn.addEventListener('mouseenter', () => setStatusUrl(item.url));
      btn.addEventListener('mouseleave', () => setStatusUrl(null));
      btn.addEventListener('focus',      () => setStatusUrl(item.url));
      btn.addEventListener('blur',       () => setStatusUrl(null));
      btn.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    }
    attachFavbarDrag(btn, item.id);
    favBar.insertBefore(btn, importBtn);
  }
}

export function showFolderPopover(folder: BookmarkFolder, anchor: HTMLElement): void {
  const folderId = anchor.dataset.bmId ?? folder.id;
  if (lastClosedFolderId === folderId && Date.now() - lastClosedAt < REOPEN_GUARD_MS) return;

  if (nativePopupOpen && currentAnchor === anchor) {
    closeFolderPopover();
    return;
  }
  closeFolderPopover();
  currentAnchor = anchor;

  void showNativeFolderPopup(folder, anchor).catch(() => {
    currentAnchor = null;
    nativePopupOpen = false;
    document.removeEventListener('pointerdown', onGlobalPointerDown, true);
    document.removeEventListener('keydown', onGlobalKeyDown, true);
  });
  document.addEventListener('pointerdown', onGlobalPointerDown, true);
  document.addEventListener('keydown', onGlobalKeyDown, true);
}

async function showNativeFolderPopup(folder: BookmarkFolder, anchor: HTMLElement): Promise<void> {
  const rect = anchor.getBoundingClientRect();
  const pad = 8;
  const width = 300;
  let left = rect.left;
  if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - width - pad);
  if (left < pad) left = pad;
  const top = rect.bottom + 2;
  const rows = flattenFolderRows(folder.children, 0);
  const height = Math.max(42, Math.min(320, rows.length * 30 + 10, window.innerHeight - top - pad));
  const win = getCurrentWindow();
  const [innerPos, scale] = await Promise.all([win.innerPosition(), win.scaleFactor()]);
  const physicalLeft = innerPos.x + Math.round(left * scale);
  const physicalTop = innerPos.y + Math.round(top * scale);
  await invoke('fav_popup_show', {
    physicalLeft,
    physicalTop,
    width,
    height,
    payload: JSON.stringify(rows),
  });
  nativePopupOpen = true;
}

export function closeFolderPopover(): void {
  const closedId = currentAnchor?.dataset.bmId ?? null;
  if (nativePopupOpen) {
    nativePopupOpen = false;
    void invoke('fav_popup_hide');
  }
  if (closedId) {
    lastClosedFolderId = closedId;
    lastClosedAt = Date.now();
  }
  currentAnchor = null;
  document.removeEventListener('pointerdown', onGlobalPointerDown, true);
  document.removeEventListener('keydown', onGlobalKeyDown, true);
}

function flattenFolderRows(items: BookmarkItem[], depth: number): PopupRow[] {
  const rows: PopupRow[] = [];
  for (const item of items) {
    if (item.type === 'folder') {
      rows.push({ kind: 'folder', name: item.name, depth });
      rows.push(...flattenFolderRows(item.children, depth + 1));
    } else {
      rows.push({ kind: 'link', title: truncate(item.title, 60), url: item.url, depth });
    }
  }
  return rows;
}
