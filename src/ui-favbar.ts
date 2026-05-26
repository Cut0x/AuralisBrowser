import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { browser, settings }                from './state.js';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { navigate }                          from './ui-nav.js';
import { showCtxMenu }                       from './ui-ctx-menu.js';
import { attachFavbarDrag, attachPopoverDrag } from './ui-favbar-drag.js';
import type { BookmarkItem, BookmarkFolder } from './storage.js';
import { logError } from './logger.js';

let currentPopover: HTMLElement | null = null;
let currentAnchor:  HTMLElement | null = null;
let nativePopupOpen = false;
let overlayParkedByPopover = false;
let lastClosedFolderId: string | null = null;
let lastClosedAt = 0;
const REOPEN_GUARD_MS = 900;
const SAFE_DISABLE_NATIVE_FOLDER_POPUP = true;

type PopupRow =
  | { kind: 'folder'; name: string; depth: number }
  | { kind: 'link'; title: string; url: string; depth: number };

function onGlobalPointerDown(e: PointerEvent): void {
  const t = e.target as Node | null;
  if (nativePopupOpen) {
    if (t && currentAnchor && currentAnchor.contains(t)) return;
    closeFolderPopover();
    return;
  }
  if (!currentPopover) return;
  if (t && (currentPopover.contains(t) || (currentAnchor && currentAnchor.contains(t)))) return;
  closeFolderPopover();
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && (currentPopover || nativePopupOpen)) closeFolderPopover();
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

  if ((currentPopover && currentAnchor === anchor) || (nativePopupOpen && currentAnchor === anchor)) {
    closeFolderPopover();
    return;
  }
  closeFolderPopover();
  currentAnchor = anchor;

  if (!SAFE_DISABLE_NATIVE_FOLDER_POPUP && browser.canShiftForOverlay) {
    void showNativeFolderPopup(folder, anchor);
    document.addEventListener('pointerdown', onGlobalPointerDown, true);
    document.addEventListener('keydown', onGlobalKeyDown, true);
    return;
  }

  if (browser.canShiftForOverlay && !overlayParkedByPopover) {
    overlayParkedByPopover = true;
    browser.parkForOverlay();
  }

  const pop = document.createElement('div');
  pop.className = 'favbar-popover';
  pop.style.left = '0px'; pop.style.top = '0px';
  renderFolderItems(folder.children, pop, 0, folder.id);
  document.body.appendChild(pop);
  currentPopover = pop;
  const rect = anchor.getBoundingClientRect();
  const pr   = pop.getBoundingClientRect();
  const pad  = 8;
  const top  = rect.bottom + 2;
  let left = rect.left;
  if (left + pr.width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pr.width - pad);
  if (left < pad) left = pad;
  const available = Math.max(80, window.innerHeight - top - pad);
  const boundedMax = Math.min(320, available);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.maxHeight = `${boundedMax}px`;
  document.addEventListener('pointerdown', onGlobalPointerDown, true);
  document.addEventListener('keydown', onGlobalKeyDown, true);
}

async function showNativeFolderPopup(folder: BookmarkFolder, anchor: HTMLElement): Promise<void> {
  try {
    const rect = anchor.getBoundingClientRect();
    const pad = 8;
    const width = 300;
    let left = rect.left;
    if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - width - pad);
    if (left < pad) left = pad;
    const top = rect.bottom + 2;
    const height = Math.max(90, Math.min(320, window.innerHeight - top - pad));
    const rows = flattenFolderRows(folder.children, 0);
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
  } catch (err) {
    nativePopupOpen = false;
    logError('favbar.showNativeFolderPopup', 'Impossible d afficher le popup natif favoris', {
      err: String(err),
    });
  }
}

function renderFolderItems(items: BookmarkItem[], container: HTMLElement, depth: number, topFolderId: string): void {
  for (const item of items) {
    if (item.type === 'folder') {
      const header = document.createElement('div');
      header.className = 'favbar-popover-separator';
      header.style.paddingLeft = `${14 + depth * 14}px`;
      header.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="margin-right:5px;vertical-align:middle"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".6"/></svg>${esc(item.name)}`;
      container.appendChild(header);
      renderFolderItems(item.children, container, depth + 1, topFolderId);
    } else {
      const btn = document.createElement('button');
      btn.className = 'favbar-popover-item'; btn.dataset.bmId = item.id;
      btn.style.paddingLeft = `${14 + depth * 14}px`;
      btn.innerHTML = `<img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"><span>${esc(truncate(item.title, 30))}</span>`;
      btn.addEventListener('click', () => { closeFolderPopover(); navigate(item.url); });
      btn.addEventListener('mouseenter', () => setStatusUrl(item.url));
      btn.addEventListener('mouseleave', () => setStatusUrl(null));
      btn.addEventListener('focus',      () => setStatusUrl(item.url));
      btn.addEventListener('blur',       () => setStatusUrl(null));
      container.appendChild(btn);
      attachPopoverDrag(btn, item.id, topFolderId, closeFolderPopover, showFolderPopover);
    }
  }
}

export function closeFolderPopover(): void {
  const closedId = currentAnchor?.dataset.bmId ?? null;
  currentPopover?.remove();
  currentPopover = null;
  if (nativePopupOpen) {
    nativePopupOpen = false;
    invoke('fav_popup_hide').catch(err => {
      logError('favbar.closeFolderPopover.hideNative', 'Echec fermeture popup natif favoris', {
        err: String(err),
      });
    });
  }
  if (overlayParkedByPopover) {
    overlayParkedByPopover = false;
    browser.restoreFromOverlay();
  }
  if (closedId) {
    lastClosedFolderId = closedId;
    lastClosedAt = Date.now();
  }
  currentAnchor = null;
  document.removeEventListener('pointerdown', onGlobalPointerDown, true);
  document.removeEventListener('keydown', onGlobalKeyDown, true);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
