// Auralis — point d'entrée principal.

import { getCurrentWindow } from '@tauri-apps/api/window';
import { TabManager }       from './tabs.js';
import { BrowserEngine }    from './browser.js';
import { SettingsPanel }    from './settings.js';
import { setLang, applyAll, t } from './i18n.js';
import {
  loadSettings, saveSettings,
  addBookmark, removeBookmark, isBookmarked, addHistoryEntry, mergeBookmarks,
  type BrowserSettings,
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

const appWindow  = getCurrentWindow();
let   settings: BrowserSettings = loadSettings();

applyTheme(settings.theme);
setLang(settings.language);
applyAll();

// ─── DOM refs ────────────────────────────────────────────────────────────────

const urlbar           = document.getElementById('urlbar')           as HTMLInputElement;
const tabStrip         = document.getElementById('tab-strip')        as HTMLElement;
const newtabSearch     = document.getElementById('newtab-searchbar') as HTMLInputElement;
const newtabFavsEl     = document.getElementById('newtab-favorites') as HTMLElement;
const newtabHint       = document.getElementById('newtab-hint')      as HTMLElement;
const favoritesBar     = document.getElementById('favorites-bar')    as HTMLElement;
const pwPanel          = document.getElementById('pw-panel')         as HTMLElement;
const pwList           = document.getElementById('pw-list')          as HTMLElement;
const pwSavePrompt     = document.getElementById('pw-save-prompt')   as HTMLElement;
const pwUsername       = document.getElementById('pw-username-input')as HTMLInputElement;
const pwPassword       = document.getElementById('pw-password-input')as HTMLInputElement;

// ─── Tab manager ─────────────────────────────────────────────────────────────

const tabs = new TabManager((allTabs, activeId) => {
  renderTabStrip(allTabs, activeId);
  const active = allTabs.find(t => t.id === activeId);
  if (active) {
    urlbar.value = active.url === 'about:newtab' ? '' : active.url;
    setNavState(active.canGoBack, active.canGoForward);
    setBookmarkActive(isBookmarked(settings, active.url));
  }
});

// ─── Browser engine ──────────────────────────────────────────────────────────

const browser = new BrowserEngine(state => {
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

// ─── Settings panel ───────────────────────────────────────────────────────────

const settingsPanel = new SettingsPanel(patch => {
  const langChanged = patch.language && patch.language !== settings.language;
  const favbarChanged = patch.showFavoritesBar !== undefined && patch.showFavoritesBar !== settings.showFavoritesBar;
  settings = { ...settings, ...patch };
  saveSettings(settings);
  applyTheme(settings.theme);
  if (langChanged) { setLang(settings.language); applyAll(); renderTabStrip(tabs.getAll(), tabs.getActiveId()); renderFavBar(); renderNewtabFavs(); }
  if (favbarChanged) { setFavoritesBarVisible(settings.showFavoritesBar); void browser.updateBounds(browser.currentUrl() !== 'about:newtab'); }
  toast(t('toast.settings_saved'), 'success');
});

// ─── Initial render ───────────────────────────────────────────────────────────

setFavoritesBarVisible(settings.showFavoritesBar);
tabs.createTab('about:newtab', true);
renderFavBar();
renderNewtabFavs();

// ─── Tab strip rendering ──────────────────────────────────────────────────────

function renderTabStrip(allTabs: ReturnType<TabManager['getAll']>, activeId: string | null): void {
  // Remove existing tab elements but keep the + button
  const newTabBtn = document.getElementById('btn-new-tab')!;
  Array.from(tabStrip.querySelectorAll('.tab')).forEach(el => el.remove());

  for (const tab of allTabs) {
    const el = document.createElement('button');
    el.className = `tab${tab.id === activeId ? ' is-active' : ''}${tab.isLoading ? ' is-loading' : ''}`;
    el.dataset.tabId = tab.id;
    el.title = tab.title;

    // Favicon
    const fav = document.createElement('span');
    fav.className = 'tab-favicon';
    fav.innerHTML = tab.isLoading
      ? `<span class="tab-spinner"></span>`
      : tab.favicon
        ? `<img src="${tab.favicon}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1" opacity=".4"/></svg>`;

    // Title
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = truncate(tab.title || t('tab.new'), 24);

    // Close
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

    el.appendChild(fav);
    el.appendChild(title);
    el.appendChild(close);
    el.addEventListener('click', () => { tabs.setActive(tab.id); browser.loadUrl(tab.url); });

    tabStrip.insertBefore(el, newTabBtn);
  }
}

// ─── Favorites bar ────────────────────────────────────────────────────────────

function renderFavBar(): void {
  const importBtn = document.getElementById('btn-favbar-import')!;
  Array.from(favoritesBar.querySelectorAll('.favbar-item')).forEach(el => el.remove());

  for (const bm of settings.bookmarks.slice(0, 14)) {
    const btn = document.createElement('button');
    btn.className = 'favbar-item';
    btn.title = bm.title;
    btn.innerHTML = `
      <img class="favbar-favicon" src="${faviconFor(bm.url)}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">
      <span class="favbar-label">${truncate(bm.title, 18)}</span>
    `;
    btn.addEventListener('click', () => navigate(bm.url));
    btn.addEventListener('contextmenu', e => { e.preventDefault(); settings = removeBookmark(settings, bm.id); saveSettings(settings); renderFavBar(); renderNewtabFavs(); });
    favoritesBar.insertBefore(btn, importBtn);
  }
}

function renderNewtabFavs(): void {
  newtabFavsEl.innerHTML = '';
  const bms = settings.bookmarks.slice(0, 8);
  newtabHint.style.display = bms.length === 0 ? '' : 'none';

  for (const bm of bms) {
    const tile = document.createElement('button');
    tile.className = 'fav-tile';
    tile.title = bm.title;
    tile.innerHTML = `
      <span class="fav-icon">
        <img src="${faviconFor(bm.url)}" width="22" height="22" alt="" loading="lazy" onerror="this.style.display='none'">
      </span>
      <span class="fav-label">${truncate(bm.title, 14)}</span>
    `;
    tile.addEventListener('click', () => navigate(bm.url));
    newtabFavsEl.appendChild(tile);
  }
}

// ─── Password indicator ───────────────────────────────────────────────────────

function checkPasswordIndicator(url: string): void {
  const matches = findForDomain(settings.passwords, url);
  const indicator = document.getElementById('pw-indicator');
  if (indicator) indicator.classList.toggle('has-saved', matches.length > 0);
}

// ─── Password manager panel ───────────────────────────────────────────────────

function renderPasswordList(): void {
  pwList.innerHTML = '';
  if (settings.passwords.length === 0) {
    pwList.innerHTML = `<p class="pw-empty">${t('pw.no_saved')}</p>`;
    return;
  }
  for (const pw of settings.passwords) {
    const row = document.createElement('div');
    row.className = 'pw-row';
    row.innerHTML = `
      <div class="pw-info">
        <span class="pw-domain">${pw.domain}</span>
        <span class="pw-user">${pw.username}</span>
      </div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-copy" data-id="${pw.id}" title="${t('pw.fill')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="1" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1" fill="var(--bg-1)"/></svg>
        </button>
        <button class="pw-btn pw-btn-delete" data-id="${pw.id}" title="${t('pw.delete')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M3 3.5l.75 8h6.5l.75-8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
    pwList.appendChild(row);
  }

  pwList.querySelectorAll('.pw-btn-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      const pw = settings.passwords.find(p => p.id === id);
      if (!pw) return;
      const plain = await decryptPassword(pw);
      navigator.clipboard.writeText(plain).then(() => toast(t('toast.copied'), 'success'));
    });
  });

  pwList.querySelectorAll('.pw-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      settings = { ...settings, passwords: deletePassword(settings.passwords, id) };
      saveSettings(settings);
      renderPasswordList();
      toast(t('toast.pw_deleted'));
    });
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(input: string): void {
  const url = resolveInput(input, settings.searchEngine);
  const active = tabs.getActive();
  if (active) tabs.updateTab(active.id, { url, title: url, isLoading: url !== 'about:newtab' });
  browser.loadUrl(url);
}

function displayTitle(url: string): string {
  if (!url || url === 'about:newtab') return t('tab.new');
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ─── URL bar ──────────────────────────────────────────────────────────────────

urlbar.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate(urlbar.value); urlbar.blur(); }
  else if (e.key === 'Escape') {
    const a = tabs.getActive();
    urlbar.value = a && a.url !== 'about:newtab' ? a.url : '';
    urlbar.blur();
  }
});
urlbar.addEventListener('focus', () => urlbar.select());

// ─── New tab search bar ───────────────────────────────────────────────────────

newtabSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter' && newtabSearch.value.trim()) { navigate(newtabSearch.value.trim()); newtabSearch.value = ''; }
});

// ─── New tab button ───────────────────────────────────────────────────────────

document.getElementById('btn-new-tab')?.addEventListener('click', () => {
  tabs.createTab('about:newtab', true);
  browser.showNewtab();
});

// ─── Nav buttons ─────────────────────────────────────────────────────────────

document.getElementById('btn-back')?.addEventListener('click',   () => browser.goBack());
document.getElementById('btn-forward')?.addEventListener('click',() => browser.goForward());
document.getElementById('btn-reload')?.addEventListener('click', () => browser.reload());

// ─── Bookmark button ──────────────────────────────────────────────────────────

document.getElementById('btn-bookmark')?.addEventListener('click', () => {
  const url = browser.currentUrl();
  if (!url || url === 'about:newtab') return;
  if (isBookmarked(settings, url)) {
    const bm = settings.bookmarks.find(b => b.url === url);
    if (bm) { settings = removeBookmark(settings, bm.id); saveSettings(settings); setBookmarkActive(false); renderFavBar(); renderNewtabFavs(); toast(t('toast.bookmark_removed')); }
  } else {
    const title = tabs.getActive()?.title || url;
    settings = addBookmark(settings, title, url);
    saveSettings(settings);
    setBookmarkActive(true);
    renderFavBar();
    renderNewtabFavs();
    toast(t('toast.bookmark_added'), 'success');
  }
});

// ─── Password manager button ──────────────────────────────────────────────────

document.getElementById('btn-passwords')?.addEventListener('click', () => {
  renderPasswordList();
  pwPanel.classList.remove('hidden');
  requestAnimationFrame(() => pwPanel.classList.add('is-open'));
});
document.getElementById('btn-close-pw')?.addEventListener('click', () => {
  pwPanel.classList.remove('is-open');
  pwPanel.addEventListener('transitionend', () => pwPanel.classList.add('hidden'), { once: true });
});
document.getElementById('pw-backdrop')?.addEventListener('click', () => {
  pwPanel.classList.remove('is-open');
  pwPanel.addEventListener('transitionend', () => pwPanel.classList.add('hidden'), { once: true });
});

// ─── Save password prompt ────────────────────────────────────────────────────

document.getElementById('btn-pw-save-confirm')?.addEventListener('click', async () => {
  const url      = browser.currentUrl();
  const domain   = extractDomain(url);
  const username = pwUsername.value.trim();
  const password = pwPassword.value;
  if (!username || !password) return;
  settings = { ...settings, passwords: await savePassword(settings.passwords, domain, username, password) };
  saveSettings(settings);
  pwSavePrompt.classList.add('hidden');
  pwUsername.value = '';
  pwPassword.value = '';
  toast(t('toast.pw_saved'), 'success');
});
document.getElementById('btn-pw-save-cancel')?.addEventListener('click', () => {
  pwSavePrompt.classList.add('hidden');
  pwUsername.value = '';
  pwPassword.value = '';
});
document.getElementById('btn-show-pw-prompt')?.addEventListener('click', () => {
  const url = browser.currentUrl();
  if (!url || url === 'about:newtab') return;
  pwSavePrompt.classList.remove('hidden');
  pwUsername.focus();
});

// ─── Settings button ──────────────────────────────────────────────────────────

document.getElementById('btn-settings')?.addEventListener('click', () => settingsPanel.show(settings));

// ─── Favorites bar import ─────────────────────────────────────────────────────

document.getElementById('btn-favbar-import')?.addEventListener('click', async () => {
  const html = await openFileDialog('.html,.htm');
  if (!html) return;
  const imported = parseNetscapeBookmarks(html);
  settings = mergeBookmarks(settings, imported);
  saveSettings(settings);
  renderFavBar();
  renderNewtabFavs();
  toast(`${t('toast.imported')} (${imported.length})`, 'success');
});

// Settings panel: import/export
document.getElementById('btn-import-bookmarks')?.addEventListener('click', async () => {
  const html = await openFileDialog('.html,.htm');
  if (!html) return;
  const imported = parseNetscapeBookmarks(html);
  settings = mergeBookmarks(settings, imported);
  saveSettings(settings);
  renderFavBar();
  renderNewtabFavs();
  toast(`${t('toast.imported')} (${imported.length})`, 'success');
});
document.getElementById('btn-export-bookmarks')?.addEventListener('click', () => {
  exportBookmarks(settings.bookmarks);
});

// ─── Window controls ─────────────────────────────────────────────────────────

document.getElementById('btn-close')?.addEventListener('click',    () => appWindow.close());
document.getElementById('btn-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    switch (e.key.toLowerCase()) {
      case 'l': e.preventDefault(); urlbar.focus(); urlbar.select(); return;
      case 't': e.preventDefault(); tabs.createTab('about:newtab', true); browser.showNewtab(); return;
      case 'w': e.preventDefault(); {
        const a = tabs.getActive();
        if (a) { tabs.closeTab(a.id); const n = tabs.getActive(); if (n) browser.loadUrl(n.url); else browser.showNewtab(); }
        return;
      }
      case 'r': e.preventDefault(); browser.reload(); return;
    }
  }
  if (e.altKey) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); browser.goBack();    return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); browser.goForward(); return; }
  }
});
