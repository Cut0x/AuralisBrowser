import { saveSettings }             from './storage.js';
import { moveBookmark }             from './bookmarks-move.js';
import { settings, updateSettings } from './state.js';
import { renderFavBar }             from './ui-favbar.js';
import { renderNewtabFavs }         from './ui-newtab.js';

let dragItemId: string | null = null;

export function bmDragClearAll(): void {
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

export function attachBmDragDrop(
  row: HTMLElement, itemId: string, isFolder: boolean,
  onDrop: () => void,
): void {
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
    if (!row.contains(e.relatedTarget as Node))
      row.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
  });
  row.addEventListener('drop', e => {
    if (!dragItemId) return; e.preventDefault(); e.stopPropagation();
    const srcId = dragItemId; dragItemId = null;
    const pos = bmDropPosition(e, row, isFolder); bmDragClearAll();
    if (srcId === itemId) return;
    updateSettings(moveBookmark(settings, srcId, itemId, pos));
    saveSettings(settings); renderFavBar(); renderNewtabFavs(); onDrop();
  });
}
