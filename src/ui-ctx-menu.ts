/**
 * ui-ctx-menu.ts — Menu contextuel des favoris et modal "Déplacer vers".
 * Le menu contextuel apparaît au clic-droit sur un favori (barre ou arbre).
 */

import { saveSettings }                                              from './storage.js';
import { removeBookmark, renameItem, moveBookmark,
         findBookmarkById, getFlatFolders, extractItem }             from './bookmarks-store.js';
import { settings, updateSettings }                                  from './state.js';
import { navigate, hideAuralisPage }                                 from './ui-nav.js';
import { renderFavBar }                                              from './ui-favbar.js';
import { renderNewtabFavs }                                          from './ui-newtab.js';
import type { BookmarkItem }                                         from './storage.js';

let ctxItemId: string | null = null;

// ─── Menu contextuel ─────────────────────────────────────────────────────────

function getCtxMenu(): HTMLElement {
  let el = document.getElementById('bm-ctx-menu');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bm-ctx-menu'; el.className = 'bm-ctx-menu'; el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

export function showCtxMenu(e: MouseEvent, itemId: string): void {
  e.preventDefault(); e.stopPropagation();
  ctxItemId = itemId;
  const item = findBookmarkById(settings.bookmarks, itemId);
  if (!item) return;

  const menu = getCtxMenu();
  menu.innerHTML = '';
  if (item.type === 'link') { addBtn(menu, 'open', '↗ Ouvrir'); addSep(menu); }
  addBtn(menu, 'rename', '✎ Renommer');
  addBtn(menu, 'move',   '⇢ Déplacer vers…');
  addSep(menu);
  addBtn(menu, 'delete', '🗑 Supprimer', true);

  const x = Math.min(e.clientX, window.innerWidth  - 200);
  const y = Math.min(e.clientY, window.innerHeight - 160);
  menu.style.cssText = `display:block;left:${x}px;top:${y}px`;
  setTimeout(() => document.addEventListener('pointerdown', closeOnOutside, { once: true }), 0);
}

function addBtn(menu: HTMLElement, action: string, label: string, danger = false): void {
  const b = document.createElement('button');
  b.className = `bm-ctx-item${danger ? ' bm-ctx-danger' : ''}`;
  b.textContent = label;
  b.addEventListener('click', () => { closeCtxMenu(); handleAction(action); });
  menu.appendChild(b);
}

function addSep(menu: HTMLElement): void {
  const d = document.createElement('div'); d.className = 'bm-ctx-sep'; menu.appendChild(d);
}

function closeCtxMenu(): void {
  const m = document.getElementById('bm-ctx-menu'); if (m) m.style.display = 'none';
}

function closeOnOutside(e: PointerEvent): void {
  const m = document.getElementById('bm-ctx-menu');
  if (m && !m.contains(e.target as Node)) closeCtxMenu();
}

function handleAction(action: string): void {
  const id = ctxItemId; ctxItemId = null;
  if (!id) return;
  const item = findBookmarkById(settings.bookmarks, id);
  if (!item) return;

  switch (action) {
    case 'open': {
      if (item.type === 'link') { hideAuralisPage(); navigate(item.url); } break;
    }
    case 'rename': {
      const name = prompt('Nouveau nom :', item.type === 'link' ? item.title : item.name);
      if (!name?.trim()) return;
      updateSettings(renameItem(settings, id, name.trim()));
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage(); break;
    }
    case 'move': showMovePicker(id); break;
    case 'delete': {
      updateSettings(removeBookmark(settings, id));
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage(); break;
    }
  }
}

// ─── Modal "Déplacer vers" ───────────────────────────────────────────────────

function showMovePicker(itemId: string): void {
  const folders = getFlatFolders(settings.bookmarks).filter(f => f.id !== itemId);
  const backdrop = document.createElement('div'); backdrop.className = 'bm-move-backdrop';
  const modal    = document.createElement('div'); modal.className = 'bm-move-modal';
  modal.innerHTML = `<div class="bm-move-title">Déplacer vers…</div>`;

  const cleanup = () => { backdrop.remove(); modal.remove(); };

  const addFolderBtn = (id: string | null, label: string) => {
    const b = document.createElement('button'); b.className = 'bm-move-item';
    b.innerHTML = id
      ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".55"/></svg><span>${esc(label)}</span>`
      : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".7"/></svg><span>${esc(label)}</span>`;
    b.addEventListener('click', () => {
      if (id) {
        updateSettings(moveBookmark(settings, itemId, id, 'inside'));
      } else {
        const [extracted, rest] = extractItem(settings.bookmarks, itemId);
        if (extracted) updateSettings({ ...settings, bookmarks: [extracted, ...rest] });
      }
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage(); cleanup();
    });
    modal.appendChild(b);
  };

  addFolderBtn(null, '↖ Racine (sans dossier)');
  for (const f of folders) addFolderBtn(f.id, f.path);

  const cancel = document.createElement('button');
  cancel.className  = 'bm-move-cancel'; cancel.textContent = 'Annuler';
  cancel.addEventListener('click', cleanup);
  modal.appendChild(cancel);
  backdrop.addEventListener('click', cleanup);
  document.body.appendChild(backdrop); document.body.appendChild(modal);
}

// ─── Rafraîchit la page Favoris si elle est ouverte ──────────────────────────

export function refreshFavorisPage(): void {
  const content = document.getElementById('ap-content');
  if (content && !document.getElementById('auralis-page')!.classList.contains('hidden')) {
    import('./ui-settings.js').then(({ renderAuralisContent }) => renderAuralisContent('favoris'));
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Ré-export pour les modules qui n'importent pas directement
export { findBookmarkById } from './bookmarks-store.js';
export type { BookmarkItem };
