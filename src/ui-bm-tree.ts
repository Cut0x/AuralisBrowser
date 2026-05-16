/**
 * ui-bm-tree.ts — Arbre interactif des favoris (page Paramètres > Favoris).
 * Gère le rendu de l'arbre, le drag-and-drop HTML5 et les actions inline.
 */

import { faviconFor }                                            from './ui.js';
import { saveSettings }                                          from './storage.js';
import { removeBookmark, renameItem, moveBookmark }              from './bookmarks-store.js';
import { settings, updateSettings }                              from './state.js';
import { navigate, hideAuralisPage }                             from './ui-nav.js';
import { renderFavBar }                                          from './ui-favbar.js';
import { renderNewtabFavs }                                      from './ui-newtab.js';
import { showCtxMenu, refreshFavorisPage }                       from './ui-ctx-menu.js';
import type { BookmarkItem }                                     from './storage.js';

let dragItemId: string | null = null;

// ─── Helpers drag-and-drop ────────────────────────────────────────────────────

function bmDragClearAll(): void {
  document.querySelectorAll<HTMLElement>('.bm-item').forEach(el =>
    el.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside', 'bm-dragging'));
}

function bmDropPosition(e: DragEvent, el: HTMLElement, isFolder: boolean): 'before' | 'after' | 'inside' {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top, h = rect.height;
  if (y < h * 0.28) return 'before';
  if (y > h * 0.72) return 'after';
  return isFolder ? 'inside' : (y < h * 0.5 ? 'before' : 'after');
}

function attachBmDragDrop(row: HTMLElement, itemId: string, isFolder: boolean): void {
  row.setAttribute('draggable', 'true');
  row.addEventListener('dragstart', e => {
    dragItemId = itemId; e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', itemId);
    setTimeout(() => row.classList.add('bm-dragging'), 0);
  });
  row.addEventListener('dragend', () => { dragItemId = null; bmDragClearAll(); });
  row.addEventListener('dragover', e => {
    if (!dragItemId || dragItemId === itemId) return;
    e.preventDefault(); e.dataTransfer!.dropEffect = 'move';
    bmDragClearAll();
    const pos = bmDropPosition(e, row, isFolder);
    row.classList.add(pos === 'before' ? 'bm-drop-before' : pos === 'after' ? 'bm-drop-after' : 'bm-drop-inside');
  });
  row.addEventListener('dragleave', e => {
    // Ne nettoie que si la souris quitte vraiment la ligne (pas un enfant)
    if (!row.contains(e.relatedTarget as Node))
      row.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
  });
  row.addEventListener('drop', e => {
    if (!dragItemId) return; e.preventDefault(); e.stopPropagation();
    const srcId = dragItemId; dragItemId = null;
    const pos = bmDropPosition(e, row, isFolder); bmDragClearAll();
    if (srcId === itemId) return;
    updateSettings(moveBookmark(settings, srcId, itemId, pos));
    saveSettings(settings); renderFavBar(); renderNewtabFavs(); refreshFavorisPage();
  });
}

// ─── Rendu de l'arbre ─────────────────────────────────────────────────────────

function makeInlineRename(nameSpan: HTMLElement, oldName: string, itemId: string): void {
  nameSpan.innerHTML = `<input class="bm-rename-input" value="${esc(oldName)}">`;
  const inp = nameSpan.querySelector<HTMLInputElement>('input')!;
  inp.focus(); inp.select();
  const commit = () => {
    const v = inp.value.trim() || oldName;
    updateSettings(renameItem(settings, itemId, v));
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    nameSpan.textContent = v;
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.stopPropagation(); commit(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); nameSpan.textContent = oldName; }
  });
}

/** Rend récursivement l'arbre de favoris dans un conteneur. */
export function renderBmTree(container: HTMLElement, items: BookmarkItem[], depth: number): void {
  for (const item of items) {
    if (item.type === 'folder') {
      const wrapper = document.createElement('div'); wrapper.className = 'bm-wrapper';
      wrapper.innerHTML = `
        <div class="bm-item" data-id="${item.id}" style="padding-left:${8 + depth * 18}px">
          <span class="bm-item-chevron open"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5 8 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>
          <span class="bm-item-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".6"/></svg></span>
          <span class="bm-item-name">${esc(item.name)}</span>
          <span class="bm-item-count">${item.children.length}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="bm-action-btn bm-delete" title="Supprimer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></button>
          </div>
        </div>
        <div class="bm-folder-children"></div>`;
      container.appendChild(wrapper);

      const row           = wrapper.querySelector<HTMLElement>('.bm-item')!;
      const childContainer = wrapper.querySelector<HTMLElement>('.bm-folder-children')!;
      renderBmTree(childContainer, item.children, depth + 1);
      attachBmDragDrop(row, item.id, true);
      row.addEventListener('contextmenu', e => showCtxMenu(e, item.id));

      const chevron = wrapper.querySelector<HTMLElement>('.bm-item-chevron')!;
      chevron.addEventListener('click', e => {
        e.stopPropagation();
        const open = chevron.classList.toggle('open');
        childContainer.style.display = open ? '' : 'none';
        chevron.innerHTML = open
          ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5 8 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`
          : `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5 3.5 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
      });

      wrapper.querySelector('.bm-rename')!.addEventListener('click', e => {
        e.stopPropagation();
        makeInlineRename(wrapper.querySelector<HTMLElement>('.bm-item-name')!, item.name, item.id);
      });
      wrapper.querySelector('.bm-delete')!.addEventListener('click', e => {
        e.stopPropagation();
        updateSettings(removeBookmark(settings, item.id));
        saveSettings(settings); renderFavBar(); renderNewtabFavs(); wrapper.remove();
      });

    } else {
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="bm-item" data-id="${item.id}" style="padding-left:${8 + depth * 18}px">
          <span class="bm-item-icon"><img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"></span>
          <span class="bm-item-name">${esc(item.title)}</span>
          <span class="bm-item-url">${esc(item.url)}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="bm-action-btn bm-delete" title="Supprimer"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></button>
          </div>
        </div>`;
      container.appendChild(row);

      const bmRow = row.querySelector<HTMLElement>('.bm-item')!;
      attachBmDragDrop(bmRow, item.id, false);
      bmRow.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
      bmRow.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('.bm-item-actions')) return;
        hideAuralisPage(); navigate(item.url);
      });
      row.querySelector('.bm-rename')!.addEventListener('click', e => {
        e.stopPropagation();
        makeInlineRename(row.querySelector<HTMLElement>('.bm-item-name')!, item.title, item.id);
      });
      row.querySelector('.bm-delete')!.addEventListener('click', e => {
        e.stopPropagation();
        updateSettings(removeBookmark(settings, item.id));
        saveSettings(settings); renderFavBar(); renderNewtabFavs(); row.remove();
      });
    }
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
