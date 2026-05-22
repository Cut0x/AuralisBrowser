import { saveSettings }         from './storage.js';
import { moveBookmark }         from './bookmarks-move.js';
import { settings, updateSettings } from './state.js';
import { renderFavBar }         from './ui-favbar.js';
import { renderNewtabFavs }     from './ui-newtab.js';
import type { BookmarkFolder }  from './storage.js';

export function attachFavbarDrag(btn: HTMLButtonElement, itemId: string): void {
  let startX = 0, dragging = false, ghost: HTMLElement | null = null;
  btn.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    startX = e.clientX; dragging = false;
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) > 5) {
        dragging = true;
        const rect = btn.getBoundingClientRect();
        ghost = btn.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;pointer-events:none;opacity:.72;z-index:9999;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;transition:none`;
        document.body.appendChild(ghost); btn.style.opacity = '0.3';
      }
      if (dragging && ghost) {
        ghost.style.left = `${ev.clientX - btn.getBoundingClientRect().width / 2}px`;
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
      ghost?.remove(); ghost = null; btn.style.opacity = '';
      document.querySelectorAll<HTMLElement>('.favbar-item,.favbar-folder').forEach(el => el.classList.remove('favbar-drag-over'));
      const target = document.elementsFromPoint(ev.clientX, ev.clientY)
        .find(x => x !== btn && (x.classList.contains('favbar-item') || x.classList.contains('favbar-folder')));
      if (target) {
        const targetId = (target as HTMLElement).dataset.bmId;
        if (targetId && targetId !== itemId) {
          const tRect = (target as HTMLElement).getBoundingClientRect();
          const pos: 'before' | 'inside' = (target.classList.contains('favbar-folder') && ev.clientX > tRect.left + tRect.width / 2) ? 'inside' : 'before';
          updateSettings(moveBookmark(settings, itemId, targetId, pos));
          saveSettings(settings); renderFavBar(); renderNewtabFavs();
        }
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  });
}

export function attachPopoverDrag(
  btn: HTMLButtonElement, itemId: string, topFolderId: string,
  onClose: () => void,
  onReopen: (folder: BookmarkFolder, anchor: HTMLElement) => void,
): void {
  let startX = 0, startY = 0, dragging = false, ghost: HTMLElement | null = null;
  let btnW = 0, btnH = 0;
  btn.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    startX = e.clientX; startY = e.clientY; dragging = false;
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true;
        const rect = btn.getBoundingClientRect(); btnW = rect.width; btnH = rect.height;
        ghost = btn.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;pointer-events:none;opacity:.72;z-index:9999;top:${rect.top}px;left:${rect.left}px;width:${btnW}px;height:${btnH}px;transition:none`;
        document.body.appendChild(ghost); btn.style.opacity = '0.3';
      }
      if (dragging && ghost) {
        ghost.style.top  = `${ev.clientY - btnH / 2}px`;
        ghost.style.left = `${ev.clientX - btnW / 2}px`;
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
      const uRect = under.getBoundingClientRect();
      const pos: 'before' | 'after' = ev.clientY < uRect.top + uRect.height / 2 ? 'before' : 'after';
      updateSettings(moveBookmark(settings, itemId, targetId, pos));
      saveSettings(settings);
      const anchor = document.querySelector<HTMLElement>(`.favbar-folder[data-bm-id="${topFolderId}"]`);
      onClose();
      import('./bookmarks-store.js').then(({ findBookmarkById }) => {
        const f = findBookmarkById(settings.bookmarks, topFolderId);
        if (f?.type === 'folder' && anchor) onReopen(f, anchor);
      });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  });
}
