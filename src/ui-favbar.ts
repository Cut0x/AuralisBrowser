import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { browser, settings }                 from './state.js';
import { navigate }                          from './ui-nav.js';
import { showCtxMenu }                       from './ui-ctx-menu.js';
import { attachFavbarDrag, attachPopoverDrag } from './ui-favbar-drag.js';
import type { BookmarkItem, BookmarkFolder } from './storage.js';

let currentPopover: HTMLElement | null = null;
let currentAnchor:  HTMLElement | null = null;
let didShiftWebview = false;

function onGlobalPointerDown(e: PointerEvent): void {
  if (!currentPopover) return;
  const t = e.target as Node | null;
  if (t && (currentPopover.contains(t) || (currentAnchor && currentAnchor.contains(t)))) return;
  closeFolderPopover();
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && currentPopover) closeFolderPopover();
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
  if (currentPopover && currentAnchor === anchor) { closeFolderPopover(); return; }
  closeFolderPopover();
  const pop = document.createElement('div');
  pop.className = 'favbar-popover';
  pop.style.left = '0px'; pop.style.top = '0px';
  renderFolderItems(folder.children, pop, 0, folder.id);
  document.body.appendChild(pop);
  currentPopover = pop; currentAnchor = anchor;
  const rect = anchor.getBoundingClientRect();
  const pr   = pop.getBoundingClientRect();
  const pad  = 8, top = rect.bottom + 2;
  let left = rect.left;
  if (left + pr.width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pr.width - pad);
  if (left < pad) left = pad;
  const available = Math.max(80, window.innerHeight - top - pad);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`; pop.style.maxHeight = `${available}px`;
  didShiftWebview = false;
  if (browser.canShiftForOverlay) {
    const popRect = pop.getBoundingClientRect();
    const popBottom = Math.min(window.innerHeight - 1, Math.max(top, popRect.bottom));
    didShiftWebview = true;
    void browser.shiftBoundsTop(popBottom + 4);
  }
  document.addEventListener('pointerdown', onGlobalPointerDown, true);
  document.addEventListener('keydown', onGlobalKeyDown, true);
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
  currentPopover?.remove(); currentPopover = null; currentAnchor = null;
  document.removeEventListener('pointerdown', onGlobalPointerDown, true);
  document.removeEventListener('keydown', onGlobalKeyDown, true);
  if (didShiftWebview) { didShiftWebview = false; browser.restoreFromOverlay(); }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
