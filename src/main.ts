import { getCurrentWindow }                from '@tauri-apps/api/window';
import { invoke }                          from '@tauri-apps/api/core';
import { TabManager }                      from './tabs.js';
import { BrowserEngine }                   from './browser.js';
import { setLang, applyAll }               from './i18n.js';
import { loadSettings, saveSettings,
         addHistoryEntry }                 from './storage.js';
import { isBookmarked }                    from './bookmarks-store.js';
import { applyTheme,
         setBookmarkActive, setFavoritesBarVisible } from './ui.js';
import { initState, settings, updateSettings } from './state.js';
import { renderTabStrip }                  from './ui-tab-strip.js';
import { navigate, displayTitle,
         showAuralisPage, hideAuralisPage,
         isAuralisPageVisible, updateApNavItems,
         getAuralisReturnUrl }             from './ui-nav.js';
import { renderFavBar, closeFolderPopover } from './ui-favbar.js';
import { renderNewtabFavs }                from './ui-newtab.js';
import { checkPasswordIndicator, tryAutofillPassword } from './ui-passwords.js';
import { renderAuralisContent }            from './ui-settings.js';
import { initBookmarkHandlers }            from './main-bm.js';
import { initPasswordHandlers }            from './main-pw.js';

const appWindow = getCurrentWindow();
const initialSettings = loadSettings();
applyTheme(initialSettings.theme); setLang(initialSettings.language); applyAll();

const tabs = new TabManager((allTabs, activeId) => {
  renderTabStrip(allTabs, activeId);
  const active = allTabs.find(tb => tb.id === activeId); if (!active) return;
  const urlbar = document.getElementById('urlbar') as HTMLInputElement;
  urlbar.value = active.url === 'about:newtab' ? '' : active.url;
  import('./ui.js').then(({ setNavState }) => setNavState(active.canGoBack, active.canGoForward));
  setBookmarkActive(isBookmarked(settings, active.url));
});

const browser = new BrowserEngine(state => {
  if (state.url !== 'about:newtab') {
    hideAuralisPage();
    document.getElementById('pw-save-prompt')?.classList.add('hidden');
    document.getElementById('bm-save-prompt')?.classList.add('hidden');
  }
  const active = tabs.getActive(); if (!active) return;
  tabs.updateTab(active.id, { url: state.url, title: state.title || displayTitle(state.url), favicon: state.favicon, isLoading: false, canGoBack: state.canBack, canGoForward: state.canForward });
  const urlbar = document.getElementById('urlbar') as HTMLInputElement;
  urlbar.value = state.url === 'about:newtab' ? '' : state.url;
  setBookmarkActive(isBookmarked(settings, state.url));
  if (state.url !== 'about:newtab') {
    updateSettings(addHistoryEntry(settings, state.title, state.url)); saveSettings(settings);
    checkPasswordIndicator(state.url); void tryAutofillPassword(state.url);
  }
});

browser.setNewTabCallback(url => { const t = tabs.createTab(url, true); browser.setActiveTabId(t.id); browser.loadUrl(url); });
browser.setPwDetectedCallback((username, password) => {
  (document.getElementById('pw-username-input') as HTMLInputElement).value = username;
  (document.getElementById('pw-password-input') as HTMLInputElement).value = password;
  document.getElementById('pw-save-prompt')?.classList.remove('hidden');
  document.getElementById('pw-username-input')?.focus();
});

initState(browser, tabs, initialSettings);
setFavoritesBarVisible(settings.showFavoritesBar);
const _firstTab = tabs.createTab('about:newtab', true);
browser.setActiveTabId(_firstTab.id);
renderFavBar(); renderNewtabFavs();
initBookmarkHandlers(); initPasswordHandlers();

document.getElementById('btn-back')?.addEventListener('click', () => {
  if (isAuralisPageVisible()) {
    hideAuralisPage();
    const ret = getAuralisReturnUrl();
    if (ret && ret !== 'about:newtab') { const a = tabs.getActive(); if (a) browser.showTabUrl(a.id, ret); } else browser.showNewtab();
  } else browser.goBack();
});
document.getElementById('btn-forward')?.addEventListener('click', () => { if (!isAuralisPageVisible()) browser.goForward(); });
document.getElementById('btn-reload')?.addEventListener('click',  () => { if (!isAuralisPageVisible()) browser.reload(); });
document.getElementById('btn-new-tab')?.addEventListener('click', () => { hideAuralisPage(); const nt = tabs.createTab('about:newtab', true); browser.setActiveTabId(nt.id); browser.showNewtab(); });

const urlbar = document.getElementById('urlbar') as HTMLInputElement;
urlbar.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate(urlbar.value); urlbar.blur(); }
  else if (e.key === 'Escape') { const a = tabs.getActive(); urlbar.value = (a && a.url !== 'about:newtab') ? a.url : ''; urlbar.blur(); }
});
urlbar.addEventListener('focus', () => urlbar.select());
document.getElementById('newtab-searchbar')?.addEventListener('keydown', (e: Event) => {
  const ev = e as KeyboardEvent; const input = ev.target as HTMLInputElement;
  if (ev.key === 'Enter' && input.value.trim()) { navigate(input.value.trim()); input.value = ''; }
});

document.getElementById('btn-settings')?.addEventListener('click', () => showAuralisPage('auralis::settings/apparence'));
document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page ?? 'apparence';
    urlbar.value = `auralis::settings/${page}`;
    updateApNavItems(page); renderAuralisContent(page);
  });
});

document.getElementById('btn-close')?.addEventListener('click',    () => appWindow.close());
document.getElementById('btn-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('btn-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());

document.getElementById('browser-chrome')!.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
  void appWindow.startDragging();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (isAuralisPageVisible()) { hideAuralisPage(); return; } closeFolderPopover(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    switch (e.key.toLowerCase()) {
      case 'l': e.preventDefault(); urlbar.focus(); urlbar.select(); return;
      case 't': e.preventDefault(); hideAuralisPage(); { const nt = tabs.createTab('about:newtab', true); browser.setActiveTabId(nt.id); } browser.showNewtab(); return;
      case 'w': e.preventDefault(); { const a = tabs.getActive(); if (a) { tabs.closeTab(a.id); hideAuralisPage(); const n = tabs.getActive(); if (n) browser.showTabUrl(n.id, n.url); else browser.showNewtab(); } } return;
      case 'r': e.preventDefault(); if (!isAuralisPageVisible()) browser.reload(); return;
    }
  }
  if (e.altKey) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); document.getElementById('btn-back')?.click(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('btn-forward')?.click(); return; }
  }
});

async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch('https://api.github.com/repos/Cut0x/AuralisBrowser/releases/latest');
    if (!res.ok) return;
    const data   = await res.json() as { tag_name?: string };
    const latest = (data.tag_name ?? '').replace(/^v/, '');
    const current = await invoke<string>('get_version');
    if (latest && latest !== current && latest > current) showUpdateBanner(latest);
  } catch { /* pas de réseau */ }
}

function showUpdateBanner(version: string): void {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner'; banner.className = 'update-banner';
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3" stroke="var(--accent-violet)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11h10" stroke="var(--accent-violet)" stroke-width="1.3" stroke-linecap="round"/></svg><span>Auralis <strong>v${version}</strong> est disponible —</span><a href="#" class="update-banner-link" id="update-go-github">Voir sur GitHub</a><button class="update-banner-close" id="update-dismiss" title="Ignorer">×</button>`;
  document.getElementById('browser-chrome')?.appendChild(banner);
  document.getElementById('update-go-github')?.addEventListener('click', e => { e.preventDefault(); import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl('https://github.com/Cut0x/AuralisBrowser/releases').catch(console.error)); });
  document.getElementById('update-dismiss')?.addEventListener('click', () => banner.remove());
}

setTimeout(() => void checkForUpdates(), 4000);
