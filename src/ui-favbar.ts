import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { settings } from './state.js';
import { navigate } from './ui-nav.js';
import { showCtxMenu } from './ui-ctx-menu.js';
import { attachFavbarDrag, attachPopoverDrag } from './ui-favbar-drag.js';
import type { BookmarkItem, BookmarkFolder } from './storage.js';

let currentPopover: HTMLElement | null = null;
let currentAnchor: HTMLElement | null = null;
let lastClosedFolderId: string | null = null;
let lastClosedAt = 0;
const REOPEN_GUARD_MS = 900;

function onGlobalPointerDown(e: PointerEvent): void {
  const t = e.target as Node | null;
  if (!currentPopover) return;
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
  const folderId = anchor.dataset.bmId ?? folder.id;
  if (lastClosedFolderId === folderId && Date.now() - lastClosedAt < REOPEN_GUARD_MS) return;

  if (currentPopover && currentAnchor === anchor) {
    closeFolderPopover();
    return;
  }
  closeFolderPopover();
  currentAnchor = anchor;
  const totalLinks = countFolderLinks(folder.children);
  const linksLabel = `${totalLinks} lien${totalLinks > 1 ? 's' : ''}`;

  const panel = document.createElement('div');
  panel.className = 'favbar-folder-panel';
  panel.setAttribute('data-tauri-drag-region', 'false');
  panel.innerHTML = `
    <div class="favbar-folder-panel-header">
      <div class="favbar-folder-panel-headline">
        <span class="favbar-folder-panel-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".65"/>
          </svg>
        </span>
        <div class="favbar-folder-panel-copy">
          <span class="favbar-folder-panel-title">${esc(folder.name)}</span>
          <span class="favbar-folder-panel-meta">${linksLabel}</span>
        </div>
      </div>
      <button class="favbar-folder-panel-close" type="button" aria-label="Fermer le dossier" title="Fermer">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 2l7 7M9 2L2 9" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>('.favbar-folder-panel-close')?.addEventListener('click', () => {
    closeFolderPopover();
  });

  const pop = document.createElement('div');
  pop.className = 'favbar-popover favbar-popover-inline';
  renderFolderItems(folder.children, pop, 0, folder.id);
  panel.appendChild(pop);

  const chrome = document.getElementById('browser-chrome');
  const favBar = document.getElementById('favorites-bar');
  if (chrome && favBar?.parentElement === chrome) {
    chrome.insertBefore(panel, favBar.nextSibling);
  } else {
    document.body.appendChild(panel);
  }
  currentPopover = panel;
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
      btn.innerHTML = `
        <img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="favbar-popover-item-copy">
          <span class="favbar-popover-item-title">${esc(truncate(item.title, 44))}</span>
          <span class="favbar-popover-item-host">${esc(displaySource(item.url))}</span>
        </span>
      `;
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

function countFolderLinks(items: BookmarkItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'folder') count += countFolderLinks(item.children);
    else count += 1;
  }
  return count;
}

function displaySource(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
