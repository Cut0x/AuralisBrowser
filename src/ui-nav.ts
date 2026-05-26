import { resolveInput } from './search.js';
import { t } from './i18n.js';
import { setNavState, setBookmarkActive } from './ui.js';
import { isBookmarked } from './bookmarks-store.js';
import { browser, tabs, settings } from './state.js';
import { setHideAuralisRef } from './ui-tab-strip.js';
import { logError } from './logger.js';
import { internalTitle, isInternalUrl, normalizeInternalUrl, parseInternalRoute, toInternalSettingsUrl } from './internal-pages.js';

let auralisReturnUrl = 'about:newtab';

export function isAuralisPageVisible(): boolean {
  return !document.getElementById('auralis-page')!.classList.contains('hidden');
}

export function showAuralisPage(url: string): void {
  try {
    const normalized = normalizeInternalUrl(url);
    const route = parseInternalRoute(normalized);
    if (!route) return;

    auralisReturnUrl = browser.currentUrl();
    browser.parkForOverlay();
    document.getElementById('newtab-page')!.classList.remove('active');
    document.getElementById('auralis-page')!.classList.remove('hidden');
    (document.getElementById('urlbar') as HTMLInputElement).value = normalized;
    setNavState(false, false);

    const active = tabs.getActive();
    if (active) {
      tabs.updateTab(active.id, {
        url: normalized,
        title: internalTitle(normalized),
        isLoading: false,
      });
    }

    import('./ui-settings.js')
      .then(({ renderAuralisContent }) => {
        if (route.kind === 'home') {
          updateApNavItems('home');
          renderAuralisContent('home');
          return;
        }
        updateApNavItems(route.section);
        renderAuralisContent(route.section);
      })
      .catch(err => {
        logError('uiNav.showAuralisPage.importSettings', 'Impossible de charger la page interne', { normalized, err: String(err) });
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
    if (isInternalUrl(url) || url.startsWith('auralis::')) {
      showAuralisPage(url);
      return;
    }
    hideAuralisPage();
    let active = tabs.getActive();
    if (!active) {
      active = tabs.createTab('about:newtab', true);
      browser.setActiveTabId(active.id);
      logError('uiNav.navigate.noActiveTab', 'Aucun onglet actif: creation d un nouvel onglet avant navigation', { input, url });
    }
    if (active) tabs.updateTab(active.id, { url, title: url, isLoading: url !== 'about:newtab' });
    browser.loadUrl(url);
  } catch (err) {
    logError('uiNav.navigate', 'Erreur critique pendant navigate', { input, err: String(err) });
  }
}

export function displayTitle(url: string): string {
  if (!url || url === 'about:newtab') return t('tab.new');
  if (isInternalUrl(url) || url.startsWith('auralis::')) {
    const normalized = normalizeInternalUrl(url);
    const route = parseInternalRoute(normalized);
    if (!route) return 'Auralis';
    if (route.kind === 'home') return 'Accueil';
    if (route.section === 'a-propos') return 'À propos';
    if (route.section === 'securite') return 'Sécurité';
    if (route.section === 'demarrage') return 'Démarrage';
    return 'Paramètres';
  }
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function getAuralisReturnUrl(): string { return auralisReturnUrl; }

export function openSettings(section?: string): void {
  if (!section) {
    showAuralisPage(toInternalSettingsUrl());
    return;
  }
  showAuralisPage(`auralis:settings/${section}`);
}

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
