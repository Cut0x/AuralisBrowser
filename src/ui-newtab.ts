/**
 * ui-newtab.ts - Tuiles de favoris sur la page Nouvel Onglet.
 * Affiche les 8 premiers favoris (liens ou dossiers) sous forme de tuiles.
 */

import { truncate, faviconFor, setStatusUrl } from './ui.js';
import { settings }              from './state.js';
import { navigate }              from './ui-nav.js';
import { showFolderPopover }     from './ui-favbar.js';
import { showCtxMenu }           from './ui-ctx-menu.js';
import type { BookmarkFolder }   from './storage.js';

/** Affiche les tuiles de favoris sur la page Nouvel Onglet. */
export function renderNewtabFavs(): void {
  const newtabFavsEl = document.getElementById('newtab-favorites')!;
  newtabFavsEl.innerHTML = '';

  for (const item of settings.bookmarks.slice(0, 8)) {
    const tile = document.createElement('button');

    if (item.type === 'folder') {
      tile.className = 'fav-tile fav-tile-folder';
      tile.title     = item.name;
      tile.innerHTML = `
        <span class="fav-icon">
          <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
            <path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".7"/>
          </svg>
        </span>
        <span class="fav-label">${truncate(item.name, 14)}</span>`;
      tile.addEventListener('click', () => showFolderPopover(item as BookmarkFolder, tile));
      tile.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    } else {
      tile.className = 'fav-tile';
      tile.title     = item.title;
      tile.innerHTML = `
        <span class="fav-icon">
          <img src="${faviconFor(item.url)}" width="22" height="22" alt="" loading="lazy" onerror="this.style.display='none'">
        </span>
        <span class="fav-label">${truncate(item.title, 14)}</span>`;
      tile.addEventListener('click', () => navigate(item.url));
      tile.addEventListener('mouseenter', () => setStatusUrl(item.url));
      tile.addEventListener('mouseleave', () => setStatusUrl(null));
      tile.addEventListener('focus',      () => setStatusUrl(item.url));
      tile.addEventListener('blur',       () => setStatusUrl(null));
      tile.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    }

    newtabFavsEl.appendChild(tile);
  }
}
