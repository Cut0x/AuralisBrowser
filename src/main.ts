import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
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
});

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
urlbar.addEventListener('keydown', e => {
  try {
    if (e.key === 'Enter') { navigate(urlbar.value); urlbar.blur(); }
    else if (e.key === 'Escape') {
      const a = tabs.getActive();
      urlbar.value = (a && a.url !== 'about:newtab') ? a.url : '';
      urlbar.blur();
    }
  } catch (err) {
    logError('main.urlbar.keydown', 'Erreur pendant traitement clavier URL bar', {
      key: e.key,
      value: urlbar.value,
      err: String(err),
    });
  }
});

urlbar.addEventListener('focus', () => urlbar.select());
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
