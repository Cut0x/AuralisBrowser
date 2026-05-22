/**
 * ui-favbar.ts — Barre des favoris (rendering + drag-to-reorder + popover dossier).
 *
 * Important : quand un popover de dossier s'ouvre, browser.shiftBoundsTop() est
 * appelé pour pousser la webview native sous le popover (sans masquer la page).
 */

import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { saveSettings }                      from './storage.js';
import { moveBookmark, findBookmarkById }     from './bookmarks-store.js';
import { browser, settings, updateSettings } from './state.js';
import { navigate }                          from './ui-nav.js';
import { renderNewtabFavs }                  from './ui-newtab.js';
import { showCtxMenu }                       from './ui-ctx-menu.js';
import type { BookmarkItem, BookmarkFolder } from './storage.js';

let currentPopover:  HTMLElement | null = null;
let currentAnchor:   HTMLElement | null = null;
let favDragId:       string | null      = null;
let favDragGhost:    HTMLElement | null = null;
let didShiftWebview: boolean            = false;

function onGlobalPointerDown(e: PointerEvent): void {
  if (!currentPopover) return;
  const target = e.target as Node | null;
  if (target && (currentPopover.contains(target) || (currentAnchor && currentAnchor.contains(target)))) return;
  closeFolderPopover();
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && currentPopover) closeFolderPopover();
}

// ─── Barre des favoris ───────────────────────────────────────────────────────

export function renderFavBar(): void {
  const favBar   = document.getElementById('favorites-bar')!;
  const importBtn = document.getElementById('btn-favbar-import')!;
  Array.from(favBar.querySelectorAll('.favbar-item, .favbar-folder')).forEach(el => el.remove());

  for (const item of settings.bookmarks.slice(0, 16)) {
    const btn = document.createElement('button');
    btn.dataset.bmId = item.id;
    btn.setAttribute('data-tauri-drag-region', 'false');

    if (item.type === 'folder') {
      btn.className = 'favbar-folder';
      btn.title     = item.name;
      btn.innerHTML = `
        <svg class="favbar-favicon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".45"/>
        </svg>
        <span class="favbar-label">${truncate(item.name, 16)}</span>
        <svg class="favbar-folder-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M2 3.5L4.5 6 7 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>`;
      btn.addEventListener('click', e => { e.stopPropagation(); showFolderPopover(item, btn); });
      btn.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    } else {
      btn.className = 'favbar-item';
      btn.title     = item.title;
      btn.innerHTML = `
        <img class="favbar-favicon" src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="favbar-label">${truncate(item.title, 16)}</span>`;
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

// ─── Drag-to-reorder (pointer events) ────────────────────────────────────────

function attachFavbarDrag(btn: HTMLButtonElement, itemId: string): void {
  let startX = 0, dragging = false;

  btn.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    startX = e.clientX; dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) > 5) {
        dragging = true; favDragId = itemId;
        const ghost = btn.cloneNode(true) as HTMLElement;
        const rect  = btn.getBoundingClientRect();
        ghost.style.cssText = `position:fixed;pointer-events:none;opacity:.72;z-index:9999;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;transition:none`;
        document.body.appendChild(ghost);
        favDragGhost = ghost; btn.style.opacity = '0.3';
      }
      if (dragging && favDragGhost) {
        favDragGhost.style.left = `${ev.clientX - btn.getBoundingClientRect().width / 2}px`;
        document.querySelectorAll<HTMLElement>('.favbar-item,.favbar-folder').forEach(el => el.classList.remove('favbar-drag-over'));
        const under = document.elementsFromPoint(ev.clientX, ev.clientY)
          .find(x => x !== btn && (x.classList.contains('favbar-item') || x.classList.contains('favbar-folder')));
        if (under) (under as HTMLElement).classList.add('favbar-drag-over');
      }
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      if (!dragging) return;
      favDragGhost?.remove(); favDragGhost = null; btn.style.opacity = '';
      document.querySelectorAll<HTMLElement>('.favbar-item,.favbar-folder').forEach(el => el.classList.remove('favbar-drag-over'));
      const srcId = favDragId; favDragId = null;
      const target = document.elementsFromPoint(ev.clientX, ev.clientY)
        .find(x => x !== btn && (x.classList.contains('favbar-item') || x.classList.contains('favbar-folder')));
      if (target && srcId) {
        const targetId = (target as HTMLElement).dataset.bmId;
        if (targetId && targetId !== srcId) {
          const targetEl = target as HTMLElement;
          const tRect = targetEl.getBoundingClientRect();
          const pos: 'before' | 'inside' = (targetEl.classList.contains('favbar-folder') && ev.clientX > tRect.left + tRect.width / 2)
            ? 'inside' : 'before';
          updateSettings(moveBookmark(settings, srcId, targetId, pos));
          saveSettings(settings); renderFavBar(); renderNewtabFavs();
        }
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  });
}

// ─── Drag-to-reorder dans le popover ─────────────────────────────────────────

function attachPopoverDrag(btn: HTMLButtonElement, itemId: string, topFolderId: string): void {
  let startX = 0, startY = 0, dragging = false;

  btn.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    startX = e.clientX; startY = e.clientY; dragging = false;
    let ghost: HTMLElement | null = null;
    let btnW = 0, btnH = 0;

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true;
        const rect = btn.getBoundingClientRect();
        btnW = rect.width; btnH = rect.height;
        ghost = btn.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;pointer-events:none;opacity:.72;z-index:9999;top:${rect.top}px;left:${rect.left}px;width:${btnW}px;height:${btnH}px;transition:none`;
        document.body.appendChild(ghost);
        btn.style.opacity = '0.3';
      }
      if (dragging && ghost) {
        ghost.style.top  = `${ev.clientY - btnH / 2}px`;
        ghost.style.left = `${ev.clientX - btnW  / 2}px`;
        document.querySelectorAll<HTMLElement>('.favbar-popover-item').forEach(el => el.classList.remove('favbar-drag-over'));
        const under = document.elementsFromPoint(ev.clientX, ev.clientY)
          .find(x => x !== btn && x.classList.contains('favbar-popover-item'));
        if (under) (under as HTMLElement).classList.add('favbar-drag-over');
      }
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      ghost?.remove(); ghost = null; btn.style.opacity = '';
      document.querySelectorAll<HTMLElement>('.favbar-popover-item').forEach(el => el.classList.remove('favbar-drag-over'));
      if (!dragging) return;

      const under = document.elementsFromPoint(ev.clientX, ev.clientY)
        .find(x => x !== btn && x.classList.contains('favbar-popover-item')) as HTMLElement | undefined;
      if (!under) return;
      const targetId = under.dataset.bmId;
      if (!targetId || targetId === itemId) return;

      const underRect = under.getBoundingClientRect();
      const pos: 'before' | 'after' = ev.clientY < underRect.top + underRect.height / 2 ? 'before' : 'after';
      updateSettings(moveBookmark(settings, itemId, targetId, pos));
      saveSettings(settings);

      // Rouvre le popover avec les données mises à jour
      const topFolder = findBookmarkById(settings.bookmarks, topFolderId);
      const anchor    = document.querySelector<HTMLElement>(`.favbar-folder[data-bm-id="${topFolderId}"]`);
      closeFolderPopover();
      if (topFolder?.type === 'folder' && anchor) showFolderPopover(topFolder, anchor);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  });
}

// ─── Popover dossier ─────────────────────────────────────────────────────────

export function showFolderPopover(folder: BookmarkFolder, anchor: HTMLElement): void {
  if (currentPopover && currentAnchor === anchor) {
    closeFolderPopover();
    return;
  }
  closeFolderPopover();

  const pop = document.createElement('div');
  pop.className = 'favbar-popover';
  pop.style.left = `0px`;
  pop.style.top  = `0px`;
  renderFolderItems(folder.children, pop, 0, folder.id);
  document.body.appendChild(pop);
  currentPopover = pop; currentAnchor = anchor;

  const rect = anchor.getBoundingClientRect();
  const pr   = pop.getBoundingClientRect();
  const pad  = 8;
  let left   = rect.left;
  const top  = rect.bottom + 2; // sous la barre des favoris

  if (left + pr.width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pr.width - pad);
  if (left < pad) left = pad;

  const available = Math.max(80, window.innerHeight - top - pad);
  pop.style.left      = `${left}px`;
  pop.style.top       = `${top}px`;
  pop.style.maxHeight = `${available}px`;

  // Pousse la WebView sous le popover si une page est visible
  didShiftWebview = browser.canShiftForOverlay;
  if (didShiftWebview) {
    const popBottom = top + Math.min(pr.height, available);
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
      btn.className = 'favbar-popover-item';
      btn.dataset.bmId = item.id;
      btn.style.paddingLeft = `${14 + depth * 14}px`;
      btn.innerHTML = `<img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"><span>${esc(truncate(item.title, 30))}</span>`;
      btn.addEventListener('click', () => { closeFolderPopover(); navigate(item.url); });
      btn.addEventListener('mouseenter', () => setStatusUrl(item.url));
      btn.addEventListener('mouseleave', () => setStatusUrl(null));
      btn.addEventListener('focus',      () => setStatusUrl(item.url));
      btn.addEventListener('blur',       () => setStatusUrl(null));
      container.appendChild(btn);
      attachPopoverDrag(btn, item.id, topFolderId);
    }
  }
}

export function closeFolderPopover(): void {
  currentPopover?.remove(); currentPopover = null;
  currentAnchor = null;
  document.removeEventListener('pointerdown', onGlobalPointerDown, true);
  document.removeEventListener('keydown', onGlobalKeyDown, true);
  if (didShiftWebview) {
    didShiftWebview = false;
    browser.restoreFromOverlay();
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
