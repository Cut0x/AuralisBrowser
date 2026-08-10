import { listen, emitTo, TauriEvent } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

type PopupRow =
  | { kind: 'folder'; name: string; depth: number }
  | { kind: 'link'; title: string; url: string; depth: number };

const root = document.getElementById('root') as HTMLElement;
const popupWindow = getCurrentWindow();

async function requestHide(): Promise<void> {
  await emitTo('main', 'fav-popup-hidden');
}

function faviconFor(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(u.hostname)}`;
  } catch {
    return '';
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function render(rows: PopupRow[]): void {
  root.innerHTML = '';
  for (const row of rows) {
    if (row.kind === 'folder') {
      const sep = document.createElement('div');
      sep.className = 'sep';
      sep.style.paddingLeft = `${14 + row.depth * 14}px`;
      sep.textContent = row.name;
      root.appendChild(sep);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'item';
    btn.type = 'button';
    btn.style.paddingLeft = `${14 + row.depth * 14}px`;
    btn.innerHTML = `<img src="${faviconFor(row.url)}" alt="" loading="lazy" onerror="this.style.display='none'"><span>${esc(row.title)}</span>`;
    btn.addEventListener('click', async () => {
      await emitTo('main', 'fav-popup-open-url', row.url);
      await requestHide();
    });
    root.appendChild(btn);
  }
}

void listen<string>('fav-popup-data', event => {
  try {
    const rows = JSON.parse(event.payload) as PopupRow[];
    render(rows);
  } catch {
    root.innerHTML = '';
  }
});

window.addEventListener('blur', () => { void requestHide(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') void requestHide(); });
void popupWindow.listen(TauriEvent.WINDOW_BLUR, () => { void requestHide(); });
