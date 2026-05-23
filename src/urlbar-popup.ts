import { emitTo, listen } from '@tauri-apps/api/event';

type SuggestItem = { title: string; url: string; selected: boolean };
const root = document.getElementById('root') as HTMLElement;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(items: SuggestItem[]): void {
  root.innerHTML = items.map((item, idx) => `
    <button class="item${item.selected ? ' active' : ''}" data-idx="${idx}" type="button">
      <span class="title">${esc(item.title)}</span>
      <span class="url">${esc(item.url)}</span>
    </button>
  `).join('');
  root.querySelectorAll<HTMLButtonElement>('.item').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', async () => {
      const idx = Number.parseInt(btn.dataset.idx || '-1', 10);
      if (idx < 0) return;
      await emitTo('main', 'urlbar-popup-select', String(idx));
    });
  });
}

void listen<string>('urlbar-popup-data', event => {
  try {
    const items = JSON.parse(event.payload) as SuggestItem[];
    render(items);
  } catch {
    root.innerHTML = '';
  }
});
