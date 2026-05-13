// Auralis — point d'entrée principal.

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke }           from '@tauri-apps/api/core';
import { TabManager }       from './tabs.js';
import { BrowserEngine }    from './browser.js';
import { setLang, applyAll, t } from './i18n.js';
import {
  loadSettings, saveSettings,
  addBookmark, removeBookmark, isBookmarked, addHistoryEntry, mergeBookmarks,
  addFolder, renameItem, findBookmarkByUrl, countBookmarkLinks,
  moveBookmark, findBookmarkById, getFlatFolders,
  getLocalStorageSize, extractItem,
  type BrowserSettings, type BookmarkItem, type BookmarkFolder,
} from './storage.js';
import {
  savePassword, deletePassword, findForDomain, decryptPassword, extractDomain,
} from './passwords.js';
import { parseNetscapeBookmarks, openFileDialog, exportBookmarks } from './import.js';
import { resolveInput } from './search.js';
import {
  applyTheme, toast, truncate, setBookmarkActive, setNavState,
  faviconFor, setFavoritesBarVisible,
} from './ui.js';

// ─── Bootstrap ──────────────────────────────────────────────────────────────

const appWindow = getCurrentWindow();
let settings: BrowserSettings = loadSettings();

applyTheme(settings.theme);
setLang(settings.language);
applyAll();

// ─── DOM refs ────────────────────────────────────────────────────────────────

const urlbar       = document.getElementById('urlbar')           as HTMLInputElement;
const tabStrip     = document.getElementById('tab-strip')        as HTMLElement;
const newtabSearch = document.getElementById('newtab-searchbar') as HTMLInputElement;
const newtabFavsEl = document.getElementById('newtab-favorites') as HTMLElement;
const newtabHint   = document.getElementById('newtab-hint')      as HTMLElement;
const favBar       = document.getElementById('favorites-bar')    as HTMLElement;
const pwPanel      = document.getElementById('pw-panel')         as HTMLElement;
const pwList       = document.getElementById('pw-list')          as HTMLElement;
const pwSavePrompt = document.getElementById('pw-save-prompt')   as HTMLElement;
const pwUsername   = document.getElementById('pw-username-input')as HTMLInputElement;
const pwPassword   = document.getElementById('pw-password-input')as HTMLInputElement;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function displayTitle(url: string): string {
  if (!url || url === 'about:newtab') return t('tab.new');
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ─── Auralis-page state ──────────────────────────────────────────────────────

let auralisReturnUrl = 'about:newtab';
let currentPopover: HTMLElement | null = null;

// ─── Drag-and-drop state ─────────────────────────────────────────────────────

let dragItemId: string | null = null;

// ─── Context menu ─────────────────────────────────────────────────────────────

let ctxItemId: string | null = null;

function getCtxMenu(): HTMLElement {
  let el = document.getElementById('bm-ctx-menu');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bm-ctx-menu';
    el.className = 'bm-ctx-menu';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function showCtxMenu(e: MouseEvent, itemId: string): void {
  e.preventDefault();
  e.stopPropagation();
  ctxItemId = itemId;

  const item = findBookmarkById(settings.bookmarks, itemId);
  if (!item) return;

  const menu = getCtxMenu();
  menu.innerHTML = '';

  if (item.type === 'link') {
    addCtxBtn(menu, 'open',   '↗ Ouvrir');
    addCtxSep(menu);
  }
  addCtxBtn(menu, 'rename', '✎ Renommer');
  addCtxBtn(menu, 'move',   '⇢ Déplacer vers…');
  addCtxSep(menu);
  addCtxBtn(menu, 'delete', '🗑 Supprimer', true);

  const x = Math.min(e.clientX, window.innerWidth  - 200);
  const y = Math.min(e.clientY, window.innerHeight - 160);
  menu.style.cssText = `display:block;left:${x}px;top:${y}px`;

  setTimeout(() => {
    document.addEventListener('pointerdown', closeCtxOnOutside, { once: true });
  }, 0);
}

function addCtxBtn(menu: HTMLElement, action: string, label: string, danger = false): void {
  const b = document.createElement('button');
  b.className = `bm-ctx-item${danger ? ' bm-ctx-danger' : ''}`;
  b.textContent = label;
  b.addEventListener('click', () => { closeCtxMenu(); handleCtxAction(action); });
  menu.appendChild(b);
}

function addCtxSep(menu: HTMLElement): void {
  const d = document.createElement('div');
  d.className = 'bm-ctx-sep';
  menu.appendChild(d);
}

function closeCtxMenu(): void {
  const menu = document.getElementById('bm-ctx-menu');
  if (menu) menu.style.display = 'none';
}

function closeCtxOnOutside(e: PointerEvent): void {
  const menu = document.getElementById('bm-ctx-menu');
  if (menu && !menu.contains(e.target as Node)) closeCtxMenu();
}

function handleCtxAction(action: string): void {
  const id = ctxItemId;
  ctxItemId = null;
  if (!id) return;

  const item = findBookmarkById(settings.bookmarks, id);
  if (!item) return;

  switch (action) {
    case 'open': {
      if (item.type === 'link') { hideAuralisPage(); navigate(item.url); }
      break;
    }
    case 'rename': {
      const name = prompt('Nouveau nom :', item.type === 'link' ? item.title : item.name);
      if (!name?.trim()) return;
      settings = renameItem(settings, id, name.trim());
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage();
      break;
    }
    case 'move': {
      showMovePicker(id);
      break;
    }
    case 'delete': {
      settings = removeBookmark(settings, id);
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage();
      break;
    }
  }
}

function refreshFavorisPage(): void {
  const content = document.getElementById('ap-content');
  if (content && !document.getElementById('auralis-page')!.classList.contains('hidden')) {
    renderPageFavoris(content);
  }
}

function showMovePicker(itemId: string): void {
  const folders = getFlatFolders(settings.bookmarks).filter(f => f.id !== itemId);

  const backdrop = document.createElement('div');
  backdrop.className = 'bm-move-backdrop';

  const modal = document.createElement('div');
  modal.className = 'bm-move-modal';
  modal.innerHTML = `<div class="bm-move-title">Déplacer vers…</div>`;

  function cleanup(): void { backdrop.remove(); modal.remove(); }

  const addFolderBtn = (id: string | null, label: string) => {
    const b = document.createElement('button');
    b.className = 'bm-move-item';
    b.innerHTML = id
      ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".55"/></svg><span>${esc(label)}</span>`
      : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".7"/></svg><span>${esc(label)}</span>`;
    b.addEventListener('click', () => {
      if (id) {
        settings = moveBookmark(settings, itemId, id, 'inside');
      } else {
        const [extracted, rest] = extractItem(settings.bookmarks, itemId);
        if (extracted) settings = { ...settings, bookmarks: [extracted, ...rest] };
      }
      saveSettings(settings); renderFavBar(); renderNewtabFavs();
      refreshFavorisPage();
      cleanup();
    });
    modal.appendChild(b);
  };

  addFolderBtn(null, '↖ Racine (sans dossier)');
  for (const f of folders) addFolderBtn(f.id, f.path);

  const cancel = document.createElement('button');
  cancel.className = 'bm-move-cancel';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', cleanup);
  modal.appendChild(cancel);

  backdrop.addEventListener('click', cleanup);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

function isAuralisPageVisible(): boolean {
  return !document.getElementById('auralis-page')!.classList.contains('hidden');
}

function showAuralisPage(url: string): void {
  auralisReturnUrl = browser.currentUrl();

  // Park the content webview off-screen
  void browser.updateBounds(false);
  // Ensure newtab HTML is hidden and auralis-page is visible
  document.getElementById('newtab-page')!.classList.remove('active');
  document.getElementById('auralis-page')!.classList.remove('hidden');

  urlbar.value = url;
  setNavState(false, false);

  const path = url.replace(/^auralis::settings\/?/, '') || 'apparence';
  updateApNavItems(path);
  renderAuralisContent(path);
}

function hideAuralisPage(): void {
  document.getElementById('auralis-page')?.classList.add('hidden');
}

function updateApNavItems(activePath: string): void {
  document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === activePath);
  });
}

// ─── Tab manager ─────────────────────────────────────────────────────────────

const tabs = new TabManager((allTabs, activeId) => {
  renderTabStrip(allTabs, activeId);
  const active = allTabs.find(tb => tb.id === activeId);
  if (active) {
    urlbar.value = active.url === 'about:newtab' ? '' : active.url;
    setNavState(active.canGoBack, active.canGoForward);
    setBookmarkActive(isBookmarked(settings, active.url));
  }
});

// ─── Browser engine ──────────────────────────────────────────────────────────

const browser = new BrowserEngine(state => {
  // When real navigation completes, close auralis-page
  if (state.url !== 'about:newtab') hideAuralisPage();

  const active = tabs.getActive();
  if (!active) return;

  tabs.updateTab(active.id, {
    url: state.url, title: state.title || displayTitle(state.url),
    favicon: state.favicon, isLoading: false,
    canGoBack: state.canBack, canGoForward: state.canForward,
  });

  urlbar.value = state.url === 'about:newtab' ? '' : state.url;
  setBookmarkActive(isBookmarked(settings, state.url));

  if (state.url !== 'about:newtab') {
    settings = addHistoryEntry(settings, state.title, state.url);
    saveSettings(settings);
    checkPasswordIndicator(state.url);
  }
});

browser.setNewTabCallback(url => {
  const id = tabs.createTab(url, true);
  void id;
  browser.loadUrl(url);
});

// ─── Initial render ───────────────────────────────────────────────────────────

setFavoritesBarVisible(settings.showFavoritesBar);
tabs.createTab('about:newtab', true);
renderFavBar();
renderNewtabFavs();

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(input: string): void {
  const url = resolveInput(input, settings.searchEngine);
  if (url.startsWith('auralis::')) {
    showAuralisPage(url);
    return;
  }
  hideAuralisPage();
  const active = tabs.getActive();
  if (active) tabs.updateTab(active.id, { url, title: url, isLoading: url !== 'about:newtab' });
  browser.loadUrl(url);
}

// ─── Tab strip ───────────────────────────────────────────────────────────────

function renderTabStrip(allTabs: ReturnType<TabManager['getAll']>, activeId: string | null): void {
  const btn = document.getElementById('btn-new-tab')!;
  Array.from(tabStrip.querySelectorAll('.tab')).forEach(el => el.remove());

  for (const tab of allTabs) {
    const el = document.createElement('button');
    el.className = `tab${tab.id === activeId ? ' is-active' : ''}`;
    el.dataset.tabId = tab.id;
    el.title = tab.title;

    const fav = document.createElement('span');
    fav.className = 'tab-favicon';
    fav.innerHTML = tab.isLoading
      ? `<span class="tab-spinner"></span>`
      : tab.favicon
        ? `<img src="${tab.favicon}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1" opacity=".4"/></svg>`;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = truncate(tab.title || t('tab.new'), 24);

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
    close.addEventListener('click', e => {
      e.stopPropagation();
      const wasActive = tab.id === activeId;
      tabs.closeTab(tab.id);
      if (wasActive) {
        const next = tabs.getActive();
        if (next) browser.loadUrl(next.url); else browser.showNewtab();
      }
    });

    el.appendChild(fav); el.appendChild(title); el.appendChild(close);
    el.addEventListener('click', () => {
      hideAuralisPage();
      tabs.setActive(tab.id);
      browser.loadUrl(tab.url);
    });
    tabStrip.insertBefore(el, btn);
  }
}

// ─── Favorites bar (with folder support) ─────────────────────────────────────

function renderFavBar(): void {
  const importBtn = document.getElementById('btn-favbar-import')!;
  Array.from(favBar.querySelectorAll('.favbar-item, .favbar-folder')).forEach(el => el.remove());

  for (const item of settings.bookmarks.slice(0, 16)) {
    if (item.type === 'folder') {
      const btn = document.createElement('button');
      btn.className = 'favbar-folder';
      btn.title = item.name;
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
      favBar.insertBefore(btn, importBtn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'favbar-item';
      btn.title = item.title;
      btn.innerHTML = `
        <img class="favbar-favicon" src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="favbar-label">${truncate(item.title, 16)}</span>`;
      btn.addEventListener('click', () => navigate(item.url));
      btn.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
      favBar.insertBefore(btn, importBtn);
    }
  }
}

function showFolderPopover(folder: BookmarkFolder, anchor: HTMLElement): void {
  closeFolderPopover();
  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'favbar-popover';
  pop.style.left = `${rect.left}px`;
  pop.style.top  = `${rect.bottom + 2}px`;
  renderFolderItems(folder.children, pop, 0);
  document.body.appendChild(pop);
  currentPopover = pop;
  setTimeout(() => document.addEventListener('click', closeFolderPopover, { once: true }), 0);
}

function renderFolderItems(items: BookmarkItem[], container: HTMLElement, depth: number): void {
  for (const item of items) {
    if (item.type === 'folder') {
      const header = document.createElement('div');
      header.className = 'favbar-popover-separator';
      header.style.paddingLeft = `${14 + depth * 14}px`;
      header.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="margin-right:5px;vertical-align:middle"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="currentColor" opacity=".6"/></svg>${esc(item.name)}`;
      container.appendChild(header);
      renderFolderItems(item.children, container, depth + 1);
    } else {
      const btn = document.createElement('button');
      btn.className = 'favbar-popover-item';
      btn.style.paddingLeft = `${14 + depth * 14}px`;
      btn.innerHTML = `<img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'"><span>${esc(truncate(item.title, 30))}</span>`;
      btn.addEventListener('click', () => { closeFolderPopover(); navigate(item.url); });
      container.appendChild(btn);
    }
  }
}

function closeFolderPopover(): void {
  currentPopover?.remove(); currentPopover = null;
}

// ─── New-tab favorites ────────────────────────────────────────────────────────

function renderNewtabFavs(): void {
  newtabFavsEl.innerHTML = '';
  const topItems = settings.bookmarks.slice(0, 8);
  newtabHint.style.display = settings.bookmarks.length === 0 ? '' : 'none';

  for (const item of topItems) {
    const tile = document.createElement('button');
    if (item.type === 'folder') {
      tile.className = 'fav-tile fav-tile-folder';
      tile.title = item.name;
      tile.innerHTML = `
        <span class="fav-icon">
          <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
            <path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".7"/>
          </svg>
        </span>
        <span class="fav-label">${truncate(item.name, 14)}</span>`;
      tile.addEventListener('click', () => showFolderPopover(item, tile));
      tile.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    } else {
      tile.className = 'fav-tile';
      tile.title = item.title;
      tile.innerHTML = `
        <span class="fav-icon">
          <img src="${faviconFor(item.url)}" width="22" height="22" alt="" loading="lazy" onerror="this.style.display='none'">
        </span>
        <span class="fav-label">${truncate(item.title, 14)}</span>`;
      tile.addEventListener('click', () => navigate(item.url));
      tile.addEventListener('contextmenu', e => showCtxMenu(e, item.id));
    }
    newtabFavsEl.appendChild(tile);
  }
}

// ─── Password helpers ─────────────────────────────────────────────────────────

function checkPasswordIndicator(url: string): void {
  const matches = findForDomain(settings.passwords, url);
  document.getElementById('pw-indicator')?.classList.toggle('has-saved', matches.length > 0);
}

function renderPasswordList(container: HTMLElement = pwList): void {
  container.innerHTML = '';
  if (settings.passwords.length === 0) {
    container.innerHTML = `<p class="pw-empty">${t('pw.no_saved')}</p>`;
    return;
  }
  for (const pw of settings.passwords) {
    const row = document.createElement('div');
    row.className = 'pw-row';
    row.innerHTML = `
      <div class="pw-info">
        <span class="pw-domain">${esc(pw.domain)}</span>
        <span class="pw-user">${esc(pw.username)}</span>
      </div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-copy" data-id="${pw.id}" title="${t('pw.fill')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="1" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1" fill="var(--bg-1)"/></svg>
        </button>
        <button class="pw-btn pw-btn-delete" data-id="${pw.id}" title="${t('pw.delete')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M3 3.5l.75 8h6.5l.75-8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    container.appendChild(row);
  }

  container.querySelectorAll('.pw-btn-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      const pw = settings.passwords.find(p => p.id === id);
      if (!pw) return;
      const plain = await decryptPassword(pw);
      navigator.clipboard.writeText(plain).then(() => toast(t('toast.copied'), 'success'));
    });
  });

  container.querySelectorAll('.pw-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      settings = { ...settings, passwords: deletePassword(settings.passwords, id) };
      saveSettings(settings);
      renderPasswordList(container);
      toast(t('toast.pw_deleted'));
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  AURALIS SETTINGS PAGES
// ═══════════════════════════════════════════════════════════════════

function renderAuralisContent(path: string): void {
  const content = document.getElementById('ap-content')!;
  content.innerHTML = '';

  switch (path) {
    case 'apparence':  renderPageApparence(content);  break;
    case 'moteur':     renderPageMoteur(content);     break;
    case 'demarrage':  renderPageDemarrage(content);  break;
    case 'favoris':    renderPageFavoris(content);    break;
    case 'historique': renderPageHistorique(content); break;
    case 'securite':   renderPageSecurite(content);   break;
    case 'cache':      renderPageCache(content);      break;
    case 'a-propos':   renderPageAPropos(content);    break;
    default:           renderPageApparence(content);
  }
}

// ─── Apparence ────────────────────────────────────────────────────────────────
function renderPageApparence(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.apparence')}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${t('settings.apparence')}</div>
      <div class="ap-row">
        <label class="ap-label" for="ap-theme">${t('settings.theme')}</label>
        <select id="ap-theme" class="setting-select">
          <option value="dark">${t('settings.theme_dark')}</option>
          <option value="light">${t('settings.theme_light')}</option>
          <option value="midnight">${t('settings.theme_midnight')}</option>
        </select>
      </div>
      <div class="ap-row">
        <label class="ap-label" for="ap-lang">${t('settings.language')}</label>
        <select id="ap-lang" class="setting-select">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="ap-row ap-row--toggle">
        <label class="ap-label" for="ap-favbar">${t('settings.favbar')}</label>
        <label class="toggle"><input type="checkbox" id="ap-favbar"><span class="toggle-track"></span></label>
      </div>
    </div>
    <div class="ap-group">
      <div class="ap-group-title">${t('settings.shortcuts')}</div>
      <div class="ap-shortcuts">
        <div class="ap-shortcut-row"><kbd>Ctrl+L</kbd><span>Barre d'adresse</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+T</kbd><span>Nouvel onglet</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+W</kbd><span>Fermer l'onglet</span></div>
        <div class="ap-shortcut-row"><kbd>Ctrl+R</kbd><span>Recharger</span></div>
        <div class="ap-shortcut-row"><kbd>Alt+←</kbd><span>Précédent</span></div>
        <div class="ap-shortcut-row"><kbd>Alt+→</kbd><span>Suivant</span></div>
      </div>
    </div>`;

  const themeEl   = el.querySelector<HTMLSelectElement>('#ap-theme')!;
  const langEl    = el.querySelector<HTMLSelectElement>('#ap-lang')!;
  const favbarEl  = el.querySelector<HTMLInputElement>('#ap-favbar')!;

  themeEl.value  = settings.theme;
  langEl.value   = settings.language;
  favbarEl.checked = settings.showFavoritesBar;

  themeEl.addEventListener('change', () => {
    settings = { ...settings, theme: themeEl.value as BrowserSettings['theme'] };
    saveSettings(settings); applyTheme(settings.theme);
  });
  langEl.addEventListener('change', () => {
    settings = { ...settings, language: langEl.value as BrowserSettings['language'] };
    saveSettings(settings); setLang(settings.language); applyAll();
    renderTabStrip(tabs.getAll(), tabs.getActiveId());
    renderFavBar(); renderNewtabFavs();
    // Re-render current page since labels changed
    renderPageApparence(el);
  });
  favbarEl.addEventListener('change', () => {
    settings = { ...settings, showFavoritesBar: favbarEl.checked };
    saveSettings(settings);
    setFavoritesBarVisible(settings.showFavoritesBar);
    void browser.updateBounds(!isAuralisPageVisible());
  });
}

// ─── Moteur ───────────────────────────────────────────────────────────────────
function renderPageMoteur(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.moteur')}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${t('settings.moteur')}</div>
      <div class="ap-row">
        <label class="ap-label" for="ap-engine">${t('settings.engine')}</label>
        <select id="ap-engine" class="setting-select">
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
          <option value="brave">Brave Search</option>
          <option value="startpage">Startpage</option>
        </select>
      </div>
    </div>`;
  const engineEl = el.querySelector<HTMLSelectElement>('#ap-engine')!;
  engineEl.value = settings.searchEngine;
  engineEl.addEventListener('change', () => {
    settings = { ...settings, searchEngine: engineEl.value as BrowserSettings['searchEngine'] };
    saveSettings(settings);
  });
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
function renderPageDemarrage(el: HTMLElement): void {
  const hp = settings.homepage === 'about:newtab' ? '' : settings.homepage;
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.demarrage')}</h2>
    <div class="ap-group">
      <div class="ap-group-title">${t('settings.homepage_url')}</div>
      <div class="ap-row ap-row--col">
        <label class="ap-label" for="ap-homepage">${t('settings.homepage_url')}</label>
        <input type="text" id="ap-homepage" class="setting-input" value="${esc(hp)}" placeholder="about:newtab"/>
      </div>
    </div>`;
  const hpEl = el.querySelector<HTMLInputElement>('#ap-homepage')!;
  const save = () => {
    settings = { ...settings, homepage: hpEl.value.trim() || 'about:newtab' };
    saveSettings(settings);
  };
  hpEl.addEventListener('blur', save);
  hpEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

// ─── Favoris ──────────────────────────────────────────────────────────────────
function renderPageFavoris(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.favoris')}</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn-outline" id="ap-bm-new-folder">${t('settings.new_folder')}</button>
      <button class="btn-outline" id="ap-bm-import">${t('settings.import_btn')}</button>
      <button class="btn-outline" id="ap-bm-export">${t('settings.export_btn')}</button>
    </div>
    <div id="ap-bm-tree" class="bm-tree"></div>`;

  renderBmTree(el.querySelector<HTMLElement>('#ap-bm-tree')!, settings.bookmarks, 0);

  el.querySelector('#ap-bm-new-folder')!.addEventListener('click', async () => {
    const name = prompt('Nom du dossier :');
    if (!name) return;
    settings = addFolder(settings, name.trim());
    saveSettings(settings);
    renderFavBar(); renderNewtabFavs();
    renderPageFavoris(el);
    toast(t('toast.folder_created'), 'success');
  });
  el.querySelector('#ap-bm-import')!.addEventListener('click', async () => {
    const html = await openFileDialog('.html,.htm');
    if (!html) return;
    const imported = parseNetscapeBookmarks(html);
    settings = mergeBookmarks(settings, imported);
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    renderPageFavoris(el);
    toast(`${t('toast.imported')} (${countBookmarkLinks(imported)})`, 'success');
  });
  el.querySelector('#ap-bm-export')!.addEventListener('click', () => exportBookmarks(settings.bookmarks));
}

function bmDragClearAll(): void {
  document.querySelectorAll<HTMLElement>('.bm-item').forEach(el =>
    el.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside', 'bm-dragging'));
}

function bmDropPosition(e: DragEvent, el: HTMLElement, isFolder: boolean): 'before' | 'after' | 'inside' {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height;
  if (y < h * 0.28) return 'before';
  if (y > h * 0.72) return 'after';
  return isFolder ? 'inside' : (y < h * 0.5 ? 'before' : 'after');
}

function attachBmDragDrop(row: HTMLElement, itemId: string, isFolder: boolean): void {
  row.setAttribute('draggable', 'true');

  row.addEventListener('dragstart', e => {
    dragItemId = itemId;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', itemId);
    setTimeout(() => row.classList.add('bm-dragging'), 0);
  });

  row.addEventListener('dragend', () => {
    dragItemId = null;
    bmDragClearAll();
  });

  row.addEventListener('dragover', e => {
    if (!dragItemId || dragItemId === itemId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    bmDragClearAll();
    const pos = bmDropPosition(e, row, isFolder);
    row.classList.add(pos === 'before' ? 'bm-drop-before' : pos === 'after' ? 'bm-drop-after' : 'bm-drop-inside');
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
  });

  row.addEventListener('drop', e => {
    if (!dragItemId) return;
    e.preventDefault(); e.stopPropagation();
    const srcId = dragItemId;
    dragItemId = null;
    const pos = bmDropPosition(e, row, isFolder);
    bmDragClearAll();
    if (srcId === itemId) return;
    settings = moveBookmark(settings, srcId, itemId, pos);
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    refreshFavorisPage();
  });
}

function renderBmTree(container: HTMLElement, items: BookmarkItem[], depth: number): void {
  for (const item of items) {
    if (item.type === 'folder') {
      const wrapper = document.createElement('div');
      wrapper.className = 'bm-wrapper';
      wrapper.innerHTML = `
        <div class="bm-item" data-id="${item.id}" style="padding-left:${8 + depth * 18}px">
          <span class="bm-item-chevron open">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5 8 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </span>
          <span class="bm-item-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".6"/></svg>
          </span>
          <span class="bm-item-name">${esc(item.name)}</span>
          <span class="bm-item-count">${item.children.length}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="bm-action-btn bm-delete" title="Supprimer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="bm-folder-children"></div>`;
      container.appendChild(wrapper);

      const row = wrapper.querySelector<HTMLElement>('.bm-item')!;
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
        const nameSpan = wrapper.querySelector<HTMLElement>('.bm-item-name')!;
        const old = item.name;
        nameSpan.innerHTML = `<input class="bm-rename-input" value="${esc(old)}">`;
        const inp = nameSpan.querySelector<HTMLInputElement>('input')!;
        inp.focus(); inp.select();
        const commit = () => {
          const v = inp.value.trim() || old;
          settings = renameItem(settings, item.id, v);
          saveSettings(settings); renderFavBar(); renderNewtabFavs();
          nameSpan.textContent = v;
        };
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.stopPropagation(); commit(); }
          if (ev.key === 'Escape') { ev.stopPropagation(); nameSpan.textContent = old; }
        });
      });

      wrapper.querySelector('.bm-delete')!.addEventListener('click', e => {
        e.stopPropagation();
        settings = removeBookmark(settings, item.id);
        saveSettings(settings); renderFavBar(); renderNewtabFavs();
        wrapper.remove();
      });

    } else {
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="bm-item" data-id="${item.id}" style="padding-left:${8 + depth * 18}px">
          <span class="bm-item-icon">
            <img src="${faviconFor(item.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">
          </span>
          <span class="bm-item-name">${esc(item.title)}</span>
          <span class="bm-item-url">${esc(item.url)}</span>
          <div class="bm-item-actions">
            <button class="bm-action-btn bm-rename" title="Renommer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9h1.5L8.5 3.5 7 2 1.5 7.5V9zM10 1L11 2l-1 1-1-1 1-1z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="bm-action-btn bm-delete" title="Supprimer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.75 7h5.5l.75-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            </button>
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
        const nameSpan = row.querySelector<HTMLElement>('.bm-item-name')!;
        const old = item.title;
        nameSpan.innerHTML = `<input class="bm-rename-input" value="${esc(old)}">`;
        const inp = nameSpan.querySelector<HTMLInputElement>('input')!;
        inp.focus(); inp.select();
        const commit = () => {
          const v = inp.value.trim() || old;
          settings = renameItem(settings, item.id, v);
          saveSettings(settings); renderFavBar(); renderNewtabFavs();
          nameSpan.textContent = v;
        };
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.stopPropagation(); commit(); }
          if (ev.key === 'Escape') { ev.stopPropagation(); nameSpan.textContent = old; }
        });
      });

      row.querySelector('.bm-delete')!.addEventListener('click', e => {
        e.stopPropagation();
        settings = removeBookmark(settings, item.id);
        saveSettings(settings); renderFavBar(); renderNewtabFavs();
        row.remove();
      });
    }
  }
}

// ─── Historique ───────────────────────────────────────────────────────────────
function renderPageHistorique(el: HTMLElement): void {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 class="ap-page-title" style="margin:0">${t('settings.historique')}</h2>
      <button class="btn-outline" id="ap-clear-hist" style="color:var(--accent-rose)">${t('settings.clear_history')}</button>
    </div>
    <div id="ap-hist-list"></div>`;

  const listEl = el.querySelector<HTMLElement>('#ap-hist-list')!;
  renderHistoryList(listEl);

  el.querySelector('#ap-clear-hist')!.addEventListener('click', () => {
    if (!confirm(t('settings.clear_confirm'))) return;
    settings = { ...settings, history: [] };
    saveSettings(settings);
    renderHistoryList(listEl);
    toast(t('toast.history_cleared'));
  });
}

function renderHistoryList(listEl: HTMLElement): void {
  listEl.innerHTML = '';
  if (settings.history.length === 0) {
    listEl.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:16px 0">Aucun historique.</p>`;
    return;
  }

  // Group by date
  const groups = new Map<string, typeof settings.history>();
  for (const entry of settings.history.slice(0, 200)) {
    const d = new Date(entry.visitedAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const label = isToday ? "Aujourd'hui" : isYesterday ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }

  groups.forEach((entries, label) => {
    const dateEl = document.createElement('div');
    dateEl.className = 'history-group-date';
    dateEl.textContent = label;
    listEl.appendChild(dateEl);

    for (const entry of entries) {
      const time = new Date(entry.visitedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <span class="history-item-time">${time}</span>
        <img class="history-item-icon" src="${faviconFor(entry.url)}" width="16" height="16" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="history-item-info">
          <div class="history-item-title">${esc(entry.title || entry.url)}</div>
          <div class="history-item-url">${esc(entry.url)}</div>
        </div>
        <button class="history-item-del" data-id="${entry.id}" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>`;
      row.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('.history-item-del')) return;
        hideAuralisPage();
        navigate(entry.url);
      });
      row.querySelector('.history-item-del')!.addEventListener('click', e => {
        e.stopPropagation();
        settings = { ...settings, history: settings.history.filter(h => h.id !== entry.id) };
        saveSettings(settings);
        row.remove();
      });
      listEl.appendChild(row);
    }
  });
}

// ─── Sécurité ─────────────────────────────────────────────────────────────────
function renderPageSecurite(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.securite')}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${t('settings.passwords_hint')}</p>
    <div id="ap-pw-list" class="pw-list" style="max-width:560px"></div>`;
  renderPasswordList(el.querySelector<HTMLElement>('#ap-pw-list')!);
}

// ─── Cache ────────────────────────────────────────────────────────────────────
function renderPageCache(el: HTMLElement): void {
  const { used, quota } = getLocalStorageSize();
  const usedKB  = (used  / 1024).toFixed(1);
  const quotaMB = (quota / (1024 * 1024)).toFixed(0);
  const pct     = Math.min(100, (used / quota) * 100).toFixed(1);
  const barColor = parseFloat(pct) > 80 ? 'var(--accent-rose)' : parseFloat(pct) > 50 ? '#f0c060' : 'var(--accent-violet)';

  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.cache')}</h2>
    <div class="ap-group" style="max-width:560px">
      <div class="ap-group-title">Stockage local</div>
      <div class="storage-bar-wrap">
        <div class="storage-bar-labels">
          <span>${usedKB} Ko utilisés</span>
          <span>${pct}% · quota ${quotaMB} Mo</span>
        </div>
        <div class="storage-bar-track">
          <div class="storage-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="storage-bar-breakdown">
          <div class="storage-breakdown-item">
            <span class="sbi-dot" style="background:var(--accent-violet)"></span>
            <span>Favoris (${countBookmarkLinks(settings.bookmarks)} liens, ${settings.bookmarks.length} items racine)</span>
          </div>
          <div class="storage-breakdown-item">
            <span class="sbi-dot" style="background:#f0c060"></span>
            <span>Historique (${settings.history.length} entrées)</span>
          </div>
          <div class="storage-breakdown-item">
            <span class="sbi-dot" style="background:var(--accent-rose)"></span>
            <span>Mots de passe (${settings.passwords.length} enregistrés)</span>
          </div>
        </div>
      </div>
    </div>
    <div class="ap-group" style="max-width:560px;margin-top:16px">
      <div class="ap-group-title">Historique de navigation</div>
      <div class="ap-row ap-row--toggle">
        <div class="ap-label">
          <strong>${t('settings.clear_history')}</strong>
          <small>${t('settings.clear_confirm')}</small>
        </div>
        <button class="btn-outline" id="ap-clear-hist2" style="flex-shrink:0;color:var(--accent-rose)">${t('settings.clear_history')}</button>
      </div>
    </div>`;
  el.querySelector('#ap-clear-hist2')!.addEventListener('click', () => {
    if (!confirm(t('settings.clear_confirm'))) return;
    settings = { ...settings, history: [] };
    saveSettings(settings);
    toast(t('toast.history_cleared'));
    renderPageCache(el);
  });
}

// ─── À propos ─────────────────────────────────────────────────────────────────
function renderPageAPropos(el: HTMLElement): void {
  invoke<string>('get_version').then(version => {
    el.innerHTML = `
      <h2 class="ap-page-title">${t('settings.a_propos')}</h2>
      <div class="ap-group" style="max-width:480px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <svg width="38" height="38" viewBox="0 0 56 56" fill="none">
            <defs><linearGradient id="abg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--accent-rose)"/><stop offset="100%" stop-color="var(--accent-violet)"/></linearGradient></defs>
            <path d="M28 8L44 46H12L28 8z" stroke="url(#abg)" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
            <path d="M18 34h20" stroke="url(#abg)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <div>
            <div class="ap-about-name">Auralis</div>
            <div class="ap-about-ver">v${esc(version)}</div>
          </div>
        </div>
        <div class="ap-about-line">${t('about.stack')}</div>
        <div class="ap-about-line">${t('about.license')}</div>
        <div style="margin-top:12px">
          <a href="#" id="ap-github-link" class="btn-outline" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </a>
        </div>
      </div>`;
    el.querySelector('#ap-github-link')!.addEventListener('click', e => {
      e.preventDefault();
      import('@tauri-apps/plugin-opener').then(({ openUrl }) => {
        openUrl('https://github.com/Cut0x/AuralisBrowser').catch(console.error);
      });
    });
  }).catch(() => {
    el.innerHTML = `<h2 class="ap-page-title">${t('settings.a_propos')}</h2><p style="color:var(--text-muted)">Auralis v0.2.0</p>`;
  });
}

// ═══════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

// ─── URL bar ──────────────────────────────────────────────────────────────────
urlbar.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate(urlbar.value); urlbar.blur(); }
  else if (e.key === 'Escape') {
    const a = tabs.getActive();
    urlbar.value = (a && a.url !== 'about:newtab') ? a.url : '';
    urlbar.blur();
  }
});
urlbar.addEventListener('focus', () => urlbar.select());

// ─── New tab searchbar ────────────────────────────────────────────────────────
newtabSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter' && newtabSearch.value.trim()) { navigate(newtabSearch.value.trim()); newtabSearch.value = ''; }
});

// ─── New tab button ───────────────────────────────────────────────────────────
document.getElementById('btn-new-tab')?.addEventListener('click', () => {
  hideAuralisPage();
  tabs.createTab('about:newtab', true);
  browser.showNewtab();
});

// ─── Navigation buttons ───────────────────────────────────────────────────────
document.getElementById('btn-back')?.addEventListener('click', () => {
  if (isAuralisPageVisible()) {
    hideAuralisPage();
    if (auralisReturnUrl && auralisReturnUrl !== 'about:newtab') {
      browser.loadUrl(auralisReturnUrl);
    } else {
      browser.showNewtab();
    }
    return;
  }
  browser.goBack();
});
document.getElementById('btn-forward')?.addEventListener('click', () => { if (!isAuralisPageVisible()) browser.goForward(); });
document.getElementById('btn-reload')?.addEventListener('click',  () => { if (!isAuralisPageVisible()) browser.reload(); });

// ─── Auralis-page nav items ───────────────────────────────────────────────────
document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page ?? 'apparence';
    const url = `auralis::settings/${page}`;
    urlbar.value = url;
    updateApNavItems(page);
    renderAuralisContent(page);
  });
});

// ─── Bookmark button ──────────────────────────────────────────────────────────
document.getElementById('btn-bookmark')?.addEventListener('click', () => {
  const url = browser.currentUrl();
  if (!url || url === 'about:newtab') return;
  const existing = findBookmarkByUrl(settings.bookmarks, url);
  if (existing) {
    settings = removeBookmark(settings, existing.id);
    saveSettings(settings); setBookmarkActive(false);
    renderFavBar(); renderNewtabFavs();
    toast(t('toast.bookmark_removed'));
  } else {
    const title = tabs.getActive()?.title || url;
    settings = addBookmark(settings, title, url);
    saveSettings(settings); setBookmarkActive(true);
    renderFavBar(); renderNewtabFavs();
    toast(t('toast.bookmark_added'), 'success');
  }
});

// ─── Password panel ───────────────────────────────────────────────────────────
document.getElementById('btn-passwords')?.addEventListener('click', () => {
  renderPasswordList(pwList);
  pwPanel.classList.remove('hidden');
  requestAnimationFrame(() => pwPanel.classList.add('is-open'));
});
document.getElementById('btn-close-pw')?.addEventListener('click', closePwPanel);
document.getElementById('pw-backdrop')?.addEventListener('click', closePwPanel);
function closePwPanel() {
  pwPanel.classList.remove('is-open');
  pwPanel.addEventListener('transitionend', () => pwPanel.classList.add('hidden'), { once: true });
}

// ─── Save password prompt ─────────────────────────────────────────────────────
document.getElementById('btn-pw-save-confirm')?.addEventListener('click', async () => {
  const url = browser.currentUrl();
  const domain   = extractDomain(url);
  const username = pwUsername.value.trim();
  const password = pwPassword.value;
  if (!username || !password) return;
  settings = { ...settings, passwords: await savePassword(settings.passwords, domain, username, password) };
  saveSettings(settings);
  pwSavePrompt.classList.add('hidden');
  pwUsername.value = ''; pwPassword.value = '';
  toast(t('toast.pw_saved'), 'success');
});
document.getElementById('btn-pw-save-cancel')?.addEventListener('click', () => {
  pwSavePrompt.classList.add('hidden'); pwUsername.value = ''; pwPassword.value = '';
});
document.getElementById('btn-show-pw-prompt')?.addEventListener('click', () => {
  const url = browser.currentUrl();
  if (!url || url === 'about:newtab') return;
  pwSavePrompt.classList.remove('hidden'); pwUsername.focus();
});

// ─── Settings button ──────────────────────────────────────────────────────────
document.getElementById('btn-settings')?.addEventListener('click', () => navigate('auralis::settings'));

// ─── Favorites bar import ─────────────────────────────────────────────────────
document.getElementById('btn-favbar-import')?.addEventListener('click', async () => {
  const html = await openFileDialog('.html,.htm');
  if (!html) return;
  const imported = parseNetscapeBookmarks(html);
  settings = mergeBookmarks(settings, imported);
  saveSettings(settings); renderFavBar(); renderNewtabFavs();
  toast(`${t('toast.imported')} (${countBookmarkLinks(imported)})`, 'success');
});

// ─── Window controls ─────────────────────────────────────────────────────────
document.getElementById('btn-close')?.addEventListener('click',    () => appWindow.close());
document.getElementById('btn-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isAuralisPageVisible()) { hideAuralisPage(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    switch (e.key.toLowerCase()) {
      case 'l': e.preventDefault(); urlbar.focus(); urlbar.select(); return;
      case 't': e.preventDefault(); hideAuralisPage(); tabs.createTab('about:newtab', true); browser.showNewtab(); return;
      case 'w': e.preventDefault(); {
        const a = tabs.getActive();
        if (a) { tabs.closeTab(a.id); hideAuralisPage(); const n = tabs.getActive(); if (n) browser.loadUrl(n.url); else browser.showNewtab(); }
        return;
      }
      case 'r': e.preventDefault(); if (!isAuralisPageVisible()) browser.reload(); return;
    }
  }
  if (e.altKey) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); document.getElementById('btn-back')?.click();    return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('btn-forward')?.click(); return; }
  }
});
