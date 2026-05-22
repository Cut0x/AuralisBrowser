import { resolveInput } from './search.js';
import { t } from './i18n.js';
import { setNavState, setBookmarkActive } from './ui.js';
import { isBookmarked } from './bookmarks-store.js';
import { browser, tabs, settings } from './state.js';
import { setHideAuralisRef } from './ui-tab-strip.js';
import { logError } from './logger.js';

let auralisReturnUrl = 'about:newtab';

export function isAuralisPageVisible(): boolean {
  return !document.getElementById('auralis-page')!.classList.contains('hidden');
}

export function showAuralisPage(url: string): void {
  try {
    auralisReturnUrl = browser.currentUrl();
    browser.parkForOverlay();
    document.getElementById('newtab-page')!.classList.remove('active');
    document.getElementById('auralis-page')!.classList.remove('hidden');
    (document.getElementById('urlbar') as HTMLInputElement).value = url;
    setNavState(false, false);
    const path = url.replace(/^auralis::settings\/?/, '') || 'apparence';
    updateApNavItems(path);
    import('./ui-settings.js')
      .then(({ renderAuralisContent }) => renderAuralisContent(path))
      .catch(err => {
        logError('uiNav.showAuralisPage.importSettings', 'Impossible de charger la page de paramètres', { path, err: String(err) });
      });
  } catch (err) {
    logError('uiNav.showAuralisPage', 'Erreur inattendue pendant showAuralisPage', { url, err: String(err) });
  }
}

export function hideAuralisPage(): void {
  try {
    document.getElementById('auralis-page')?.classList.add('hidden');
    browser.restoreFromOverlay();
  } catch (err) {
    logError('uiNav.hideAuralisPage', 'Erreur inattendue pendant hideAuralisPage', { err: String(err) });
  }
}

export function updateApNavItems(activePath: string): void {
  try {
    document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === activePath);
    });
  } catch (err) {
    logError('uiNav.updateApNavItems', 'Erreur inattendue pendant updateApNavItems', { activePath, err: String(err) });
  }
}

export function navigate(input: string): void {
  try {
    const url = resolveInput(input, settings.searchEngine);
    if (url.startsWith('auralis::')) { showAuralisPage(url); return; }
    hideAuralisPage();
    const active = tabs.getActive();
    if (active) tabs.updateTab(active.id, { url, title: url, isLoading: url !== 'about:newtab' });
    browser.loadUrl(url);
  } catch (err) {
    logError('uiNav.navigate', 'Erreur critique pendant navigate', { input, err: String(err) });
  }
}

export function displayTitle(url: string): string {
  if (!url || url === 'about:newtab') return t('tab.new');
  if (url.startsWith('auralis::settings')) return 'Paramètres';
  if (url.startsWith('auralis::')) return url.replace('auralis::', '');
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function getAuralisReturnUrl(): string { return auralisReturnUrl; }

export function syncUrlBarToTab(url: string, canBack: boolean, canForward: boolean): void {
  try {
    const urlbar = document.getElementById('urlbar') as HTMLInputElement;
    urlbar.value = url === 'about:newtab' ? '' : url;
    setNavState(canBack, canForward);
    setBookmarkActive(isBookmarked(settings, url));
  } catch (err) {
    logError('uiNav.syncUrlBarToTab', 'Erreur inattendue pendant syncUrlBarToTab', { url, canBack, canForward, err: String(err) });
  }
}

setHideAuralisRef(hideAuralisPage);

