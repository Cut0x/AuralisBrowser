import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen, TauriEvent } from '@tauri-apps/api/event';
import { TabManager } from './tabs.js';
import { BrowserEngine } from './browser.js';
import { setLang, applyAll } from './i18n.js';
import { loadSettings, saveSettings, addHistoryEntry } from './storage.js';
import { isBookmarked } from './bookmarks-store.js';
import { applyTheme, setBookmarkActive, setFavoritesBarVisible } from './ui.js';
import { initState, settings, updateSettings } from './state.js';
import { renderTabStrip } from './ui-tab-strip.js';
import {
  navigate,
  displayTitle,
  showAuralisPage,
  hideAuralisPage,
  isAuralisPageVisible,
  updateApNavItems,
  getAuralisReturnUrl,
} from './ui-nav.js';
import { renderFavBar, closeFolderPopover } from './ui-favbar.js';
import { renderNewtabFavs } from './ui-newtab.js';
import { checkPasswordIndicator, tryAutofillPassword } from './ui-passwords.js';
import { renderAuralisContent } from './ui-settings.js';
import { initBookmarkHandlers } from './main-bm.js';
import { initPasswordHandlers } from './main-pw.js';
import { logError } from './logger.js';
import { isInternalUrl, normalizeInternalUrl } from './internal-pages.js';

const FIRST_RUN_KEY = 'auralis_first_install_done_v1';
const FIRST_RUN_WELCOME_URL = 'https://auralisbrowser.fr/welcome';

const appWindow = getCurrentWindow();
const initialSettings = loadSettings();
if (initialSettings.maxLiveTabs !== 3) {
  initialSettings.maxLiveTabs = 3;
  saveSettings(initialSettings);
}
applyTheme(initialSettings.theme);
setLang(initialSettings.language);
applyAll();

window.addEventListener('error', ev => {
  logError('main.window.error', ev.message || 'Erreur JavaScript non interceptée', {
    file: ev.filename,
    line: ev.lineno,
    column: ev.colno,
  });
});

window.addEventListener('unhandledrejection', ev => {
  logError('main.window.unhandledRejection', 'Promesse rejetée sans catch', {
    reason: String(ev.reason),
  });
});

const tabs = new TabManager((allTabs, activeId) => {
  renderTabStrip(allTabs, activeId);
  const active = allTabs.find(tb => tb.id === activeId); if (!active) return;
  const urlbar = document.getElementById('urlbar') as HTMLInputElement;
  urlbar.value = active.url === 'about:newtab' ? '' : active.url;
  import('./ui.js')
    .then(({ setNavState }) => setNavState(active.canGoBack, active.canGoForward))
    .catch(err => {
      logError('main.tabs.importUi', 'Chargement de setNavState impossible', { err: String(err) });
    });
  setBookmarkActive(isBookmarked(settings, active.url));
});

const browser = new BrowserEngine(state => {
  if (state.url !== 'about:newtab') {
    hideAuralisPage();
    document.getElementById('pw-save-prompt')?.classList.add('hidden');
    document.getElementById('bm-save-prompt')?.classList.add('hidden');
  }
  const active = tabs.getActive(); if (!active) return;
  tabs.updateTab(active.id, {
    url: state.url,
    title: state.title || displayTitle(state.url),
    favicon: state.favicon,
    isLoading: false,
    canGoBack: state.canBack,
    canGoForward: state.canForward,
  });
  const urlbar = document.getElementById('urlbar') as HTMLInputElement;
  urlbar.value = state.url === 'about:newtab' ? '' : state.url;
  setBookmarkActive(isBookmarked(settings, state.url));
  if (state.url !== 'about:newtab') {
    updateSettings(addHistoryEntry(settings, state.title, state.url));
    saveSettings(settings);
    checkPasswordIndicator(state.url);
    void tryAutofillPassword(state.url);
  }
}, { maxLiveTabs: initialSettings.maxLiveTabs });

browser.setNewTabCallback(url => {
  const t = tabs.createTab(url, true);
  browser.setActiveTabId(t.id);
  browser.loadUrl(url);
});

browser.setPwDetectedCallback((username, password) => {
  (document.getElementById('pw-username-input') as HTMLInputElement).value = username;
  (document.getElementById('pw-password-input') as HTMLInputElement).value = password;
  document.getElementById('pw-save-prompt')?.classList.remove('hidden');
  document.getElementById('pw-username-input')?.focus();
});

initState(browser, tabs, initialSettings);
setFavoritesBarVisible(settings.showFavoritesBar);
renderFavBar();
renderNewtabFavs();
initBookmarkHandlers();
initPasswordHandlers();
initAppContextMenu();

void listen<string>('fav-popup-open-url', event => {
  closeFolderPopover();
  navigate(event.payload);
});
void listen('fav-popup-hidden', () => { closeFolderPopover(); });
void appWindow.listen(TauriEvent.WINDOW_BLUR, () => { closeFolderPopover(); });
void appWindow.listen(TauriEvent.WINDOW_FOCUS, () => { closeFolderPopover(); });

void browser.ensureEventsReady()
  .then(() => {
    const startupUrl = resolveStartupUrl();
    const firstTab = tabs.createTab(startupUrl, true);
    browser.setActiveTabId(firstTab.id);
    openUrlInActiveTab(startupUrl);
  })
  .catch(err => {
    logError('main.startup.ensureEventsReady', 'Initialisation navigateur incomplète', { err: String(err) });
  });

document.getElementById('btn-back')?.addEventListener('click', () => {
  try {
    if (isAuralisPageVisible()) {
      hideAuralisPage();
      const ret = getAuralisReturnUrl();
      if (ret && ret !== 'about:newtab') {
        const active = tabs.getActive();
        if (!active) return;
        openUrlInActiveTab(ret);
      } else {
        browser.showNewtab();
      }
    } else {
      browser.goBack();
    }
  } catch (err) {
    logError('main.btnBack', 'Erreur pendant action retour', { err: String(err) });
  }
});

document.getElementById('btn-forward')?.addEventListener('click', () => {
  try { if (!isAuralisPageVisible()) browser.goForward(); }
  catch (err) { logError('main.btnForward', 'Erreur pendant action avant', { err: String(err) }); }
});

document.getElementById('btn-reload')?.addEventListener('click', () => {
  try { if (!isAuralisPageVisible()) browser.reload(); }
  catch (err) { logError('main.btnReload', 'Erreur pendant action recharger', { err: String(err) }); }
});
document.getElementById('btn-home')?.addEventListener('click', () => {
  try { openUrlInActiveTab('auralis:home'); }
  catch (err) { logError('main.btnHome', 'Erreur pendant action accueil', { err: String(err) }); }
});

document.getElementById('btn-new-tab')?.addEventListener('click', () => {
  try {
    hideAuralisPage();
    const nt = tabs.createTab('about:newtab', true);
    browser.setActiveTabId(nt.id);
    browser.showNewtab();
  } catch (err) {
    logError('main.btnNewTab', 'Erreur pendant ouverture nouvel onglet', { err: String(err) });
  }
});

const urlbar = document.getElementById('urlbar') as HTMLInputElement;
type UrlbarSuggestion = { title: string; url: string; haystack: string };
let suggestions: UrlbarSuggestion[] = [];
let activeSuggestIdx = -1;
let suggestPopupOpen = false;
let suppressNextFocusSuggest = false;

function extractSearchTerm(url: string): string {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q') ?? u.searchParams.get('query') ?? '';
    return decodeURIComponent(q).trim();
  } catch {
    return '';
  }
}

async function hideSuggestions(): Promise<void> {
  activeSuggestIdx = -1;
  if (!suggestPopupOpen) return;
  suggestPopupOpen = false;
  await invoke('urlbar_popup_hide');
}

function applySuggestion(idx: number): void {
  const s = suggestions[idx];
  if (!s) return;
  urlbar.value = s.url;
  suppressNextFocusSuggest = true;
  void hideSuggestions();
  navigate(s.url);
}

async function renderSuggestions(items: UrlbarSuggestion[]): Promise<void> {
  suggestions = items;
  activeSuggestIdx = -1;
  if (!items.length) { await hideSuggestions(); return; }
  const wrap = document.querySelector<HTMLElement>('.urlbar-wrapper');
  if (!wrap) { await hideSuggestions(); return; }
  const rect = wrap.getBoundingClientRect();
  const height = Math.max(56, Math.min(320, items.length * 46 + 12));
  const winPos = await appWindow.innerPosition();
  const scale = await appWindow.scaleFactor();
  const payload = JSON.stringify(items.map((s, i) => ({ title: s.title, url: s.url, selected: i === activeSuggestIdx })));
  await invoke('urlbar_popup_show', {
    physicalLeft: winPos.x + Math.round(rect.left * scale),
    physicalTop: winPos.y + Math.round((rect.bottom + 4) * scale),
    width: rect.width,
    height,
    payload,
  });
  suggestPopupOpen = true;
}

function collectUrlbarSuggestions(query: string): UrlbarSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const out: UrlbarSuggestion[] = [];
  for (const h of settings.history) {
    const queryTerm = extractSearchTerm(h.url);
    const title = queryTerm ? `Recherche: ${queryTerm}` : (h.title || h.url);
    const haystack = `${title} ${h.url} ${queryTerm}`.toLowerCase();
    if (!haystack.includes(q)) continue;
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push({ title, url: h.url, haystack });
    if (out.length >= 8) break;
  }
  return out;
}

function updateSuggestionsFromInput(): void {
  if (document.activeElement !== urlbar) {
    void hideSuggestions();
    return;
  }
  void renderSuggestions(collectUrlbarSuggestions(urlbar.value));
}

urlbar.addEventListener('keydown', e => {
  try {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      activeSuggestIdx = Math.min(suggestions.length - 1, activeSuggestIdx + 1);
      void renderSuggestions(suggestions);
      return;
    }
    if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      activeSuggestIdx = Math.max(0, activeSuggestIdx - 1);
      void renderSuggestions(suggestions);
      return;
    }
    if (e.key === 'Enter') {
      if (activeSuggestIdx >= 0 && suggestions[activeSuggestIdx]) {
        e.preventDefault();
        applySuggestion(activeSuggestIdx);
      } else {
        navigate(urlbar.value);
        urlbar.blur();
      }
      return;
    } else if (e.key === 'Escape') {
      const a = tabs.getActive();
      urlbar.value = (a && a.url !== 'about:newtab') ? a.url : '';
      void hideSuggestions();
      urlbar.blur();
      return;
    }
  } catch (err) {
    logError('main.urlbar.keydown', 'Erreur pendant traitement clavier URL bar', {
      key: e.key,
      value: urlbar.value,
      err: String(err),
    });
  }
});

urlbar.addEventListener('focus', () => {
  urlbar.select();
  if (suppressNextFocusSuggest) {
    suppressNextFocusSuggest = false;
    return;
  }
  updateSuggestionsFromInput();
});
urlbar.addEventListener('input', () => updateSuggestionsFromInput());
urlbar.addEventListener('blur', () => { setTimeout(() => { void hideSuggestions(); }, 80); });
window.addEventListener('resize', () => updateSuggestionsFromInput());
window.addEventListener('scroll', () => updateSuggestionsFromInput(), true);
document.addEventListener('pointerdown', ev => {
  const t = ev.target as HTMLElement | null;
  if (!t) return;
  if (t === urlbar || t.closest('.urlbar-wrapper')) return;
  void hideSuggestions();
});
void listen<string>('urlbar-popup-select', event => {
  const idx = Number.parseInt(event.payload || '-1', 10);
  if (idx >= 0) applySuggestion(idx);
});
void listen('urlbar-popup-hidden', () => {
  suggestPopupOpen = false;
  activeSuggestIdx = -1;
});
document.getElementById('newtab-searchbar')?.addEventListener('keydown', (e: Event) => {
  try {
    const ev = e as KeyboardEvent;
    const input = ev.target as HTMLInputElement;
    if (ev.key === 'Enter' && input.value.trim()) {
      navigate(input.value.trim());
      input.value = '';
    }
  } catch (err) {
    logError('main.newtabSearch.keydown', 'Erreur pendant recherche nouvel onglet', { err: String(err) });
  }
});

document.getElementById('btn-settings')?.addEventListener('click', () => showAuralisPage('auralis:settings'));
document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page ?? 'home';
    const internalUrl = page === 'home' ? 'auralis:home' : `auralis:settings/${page}`;
    urlbar.value = internalUrl;
    updateApNavItems(page);
    renderAuralisContent(page);
    const active = tabs.getActive();
    if (active) tabs.updateTab(active.id, { url: internalUrl, title: displayTitle(internalUrl), isLoading: false });
  });
});

document.getElementById('btn-close')?.addEventListener('click', () => appWindow.close());
document.getElementById('btn-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());

document.getElementById('browser-chrome')!.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
  void appWindow.startDragging();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (isAuralisPageVisible()) {
      hideAuralisPage();
      return;
    }
    closeFolderPopover();
    return;
  }

  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    switch (e.key.toLowerCase()) {
      case 'l':
        e.preventDefault();
        urlbar.focus();
        urlbar.select();
        return;
      case 't':
        e.preventDefault();
        hideAuralisPage();
        {
          const nt = tabs.createTab('about:newtab', true);
          browser.setActiveTabId(nt.id);
        }
        browser.showNewtab();
        return;
      case 'w':
        e.preventDefault();
        {
          const a = tabs.getActive();
          if (a) {
            tabs.closeTab(a.id);
            hideAuralisPage();
            const n = tabs.getActive();
            if (n) openUrlInActiveTab(n.url);
            else browser.showNewtab();
          }
        }
        return;
      case 'r':
        e.preventDefault();
        if (!isAuralisPageVisible()) browser.reload();
        return;
    }
  }

  if (e.altKey) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      document.getElementById('btn-back')?.click();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      document.getElementById('btn-forward')?.click();
      return;
    }
  }
});

window.addEventListener('blur', () => { closeFolderPopover(); });

async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch('https://api.github.com/repos/Cut0x/AuralisBrowser/releases/latest');
    if (!res.ok) return;
    const data = await res.json() as { tag_name?: string };
    const latest = (data.tag_name ?? '').replace(/^v/, '');
    const current = await invoke<string>('get_version');
    if (latest && latest !== current && latest > current) showUpdateBanner(latest);
  } catch (err) {
    logError('main.checkForUpdates', 'Vérification des mises à jour impossible', { err: String(err) });
  }
}

function showUpdateBanner(version: string): void {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3" stroke="var(--accent-violet)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11h10" stroke="var(--accent-violet)" stroke-width="1.3" stroke-linecap="round"/></svg><span>Auralis <strong>v${version}</strong> est disponible -</span><a href="#" class="update-banner-link" id="update-go-github">Voir sur GitHub</a><button class="update-banner-close" id="update-dismiss" title="Ignorer">×</button>`;
  document.getElementById('browser-chrome')?.appendChild(banner);

  document.getElementById('update-go-github')?.addEventListener('click', e => {
    e.preventDefault();
    import('@tauri-apps/plugin-opener')
      .then(({ openUrl }) => openUrl('https://github.com/Cut0x/AuralisBrowser/releases').catch(err => {
        logError('main.updateBanner.openRelease', 'Ouverture de la page releases impossible', { err: String(err) });
      }))
      .catch(err => {
        logError('main.updateBanner.importOpener', 'Chargement du plugin opener impossible', { err: String(err) });
      });
  });

  document.getElementById('update-dismiss')?.addEventListener('click', () => banner.remove());
}

function resolveStartupUrl(): string {
  const firstRunDone = localStorage.getItem(FIRST_RUN_KEY) === '1';
  if (!firstRunDone) {
    localStorage.setItem(FIRST_RUN_KEY, '1');
    return FIRST_RUN_WELCOME_URL;
  }
  const candidate = (settings.homepage || '').trim() || 'auralis:home';
  if (candidate.startsWith('auralis::')) return normalizeInternalUrl(candidate);
  return candidate;
}

function openUrlInActiveTab(url: string): void {
  const normalized = url.startsWith('auralis::') ? normalizeInternalUrl(url) : url;
  const active = tabs.getActive();
  if (!active) return;
  tabs.updateTab(active.id, {
    url: normalized,
    title: displayTitle(normalized),
    isLoading: normalized !== 'about:newtab' && !isInternalUrl(normalized),
  });

  if (normalized === 'about:newtab') {
    browser.showNewtab();
    return;
  }

  if (isInternalUrl(normalized)) {
    showAuralisPage(normalized);
    return;
  }

  hideAuralisPage();
  browser.loadUrl(normalized);
}

function initAppContextMenu(): void {
  const menu = document.createElement('div');
  menu.id = 'app-ctx-menu';
  menu.className = 'bm-ctx-menu';
  menu.style.display = 'none';
  menu.innerHTML = '<button class="bm-ctx-item" id="app-ctx-console">Console Auralis</button>';
  document.body.appendChild(menu);

  const hideMenu = (): void => { menu.style.display = 'none'; };

  document.addEventListener('contextmenu', ev => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('#bm-ctx-menu') || target.closest('.bm-move-modal')) return;
    if (target.matches('input, textarea, [contenteditable="true"]')) return;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;

    ev.preventDefault();
    const maxX = window.innerWidth - 190;
    const maxY = window.innerHeight - 80;
    menu.style.left = `${Math.max(8, Math.min(ev.clientX, maxX))}px`;
    menu.style.top = `${Math.max(8, Math.min(ev.clientY, maxY))}px`;
    menu.style.display = 'block';
  });

  document.addEventListener('pointerdown', ev => {
    if (!menu.contains(ev.target as Node)) hideMenu();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') hideMenu();
  });

  document.getElementById('app-ctx-console')?.addEventListener('click', () => {
    hideMenu();
    invoke<void>('console_show').catch(err => {
      logError('main.contextMenu.console', 'Impossible d ouvrir la Console Auralis', { err: String(err) });
    });
  });
}

setTimeout(() => void checkForUpdates(), 4000);

