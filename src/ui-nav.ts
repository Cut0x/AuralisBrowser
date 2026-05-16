/**
 * ui-nav.ts — Navigation principale : résolution d'URL, pages Auralis, bande d'onglets.
 * Toutes les fonctions d'affichage/masquage de la page de paramètres sont ici.
 */

import { resolveInput }                             from './search.js';
import { t }                                        from './i18n.js';
import { truncate, setNavState, setBookmarkActive,
         faviconFor }                               from './ui.js';
import { isBookmarked }                             from './bookmarks-store.js';
import { browser, tabs, settings }                  from './state.js';
import type { Tab }                                 from './tabs.js';

// URL mémorisée avant d'ouvrir une page Auralis (pour le bouton Retour)
let auralisReturnUrl = 'about:newtab';

// ─── Pages Auralis (auralis::settings/...) ───────────────────────────────────

export function isAuralisPageVisible(): boolean {
  return !document.getElementById('auralis-page')!.classList.contains('hidden');
}

export function showAuralisPage(url: string): void {
  auralisReturnUrl = browser.currentUrl();
  void browser.updateBounds(false); // masque la webview : la page Auralis la remplace
  document.getElementById('newtab-page')!.classList.remove('active');
  document.getElementById('auralis-page')!.classList.remove('hidden');
  ;(document.getElementById('urlbar') as HTMLInputElement).value = url;
  setNavState(false, false);
  const path = url.replace(/^auralis::settings\/?/, '') || 'apparence';
  updateApNavItems(path);
  // Import dynamique pour éviter les dépendances circulaires
  import('./ui-settings.js').then(({ renderAuralisContent }) => renderAuralisContent(path));
}

export function hideAuralisPage(): void {
  document.getElementById('auralis-page')?.classList.add('hidden');
}

export function updateApNavItems(activePath: string): void {
  document.querySelectorAll<HTMLElement>('#ap-nav .ap-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === activePath);
  });
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export function navigate(input: string): void {
  const url = resolveInput(input, settings.searchEngine);
  if (url.startsWith('auralis::')) { showAuralisPage(url); return; }
  hideAuralisPage();
  const active = tabs.getActive();
  if (active) tabs.updateTab(active.id, { url, title: url, isLoading: url !== 'about:newtab' });
  browser.loadUrl(url);
}

export function displayTitle(url: string): string {
  if (!url || url === 'about:newtab') return t('tab.new');
  if (url.startsWith('auralis::settings')) return 'Paramètres';
  if (url.startsWith('auralis::')) return url.replace('auralis::', '');
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function getAuralisReturnUrl(): string { return auralisReturnUrl; }

// ─── Bande d'onglets ─────────────────────────────────────────────────────────

export function renderTabStrip(allTabs: Tab[], activeId: string | null): void {
  const tabStrip = document.getElementById('tab-strip')!;
  const btn      = document.getElementById('btn-new-tab')!;
  Array.from(tabStrip.querySelectorAll('.tab')).forEach(el => el.remove());

  for (const tab of allTabs) {
    const el = document.createElement('button');
    el.className  = `tab${tab.id === activeId ? ' is-active' : ''}`;
    el.dataset.tabId = tab.id;
    el.title      = tab.title;

    const fav = document.createElement('span');
    fav.className = 'tab-favicon';
    fav.innerHTML = tab.isLoading
      ? `<span class="tab-spinner"></span>`
      : tab.favicon
        ? `<img src="${tab.favicon}" width="14" height="14" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1" opacity=".4"/></svg>`;

    const title = document.createElement('span');
    title.className  = 'tab-title';
    title.textContent = truncate(tab.title || t('tab.new'), 24);

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
    close.addEventListener('click', e => {
      e.stopPropagation();
      const wasActive = tab.id === activeId;
      tabs.closeTab(tab.id);
      if (wasActive) { const n = tabs.getActive(); if (n) browser.loadUrl(n.url); else browser.showNewtab(); }
    });

    el.appendChild(fav); el.appendChild(title); el.appendChild(close);
    el.addEventListener('click', () => { hideAuralisPage(); tabs.setActive(tab.id); browser.loadUrl(tab.url); });
    tabStrip.insertBefore(el, btn);
  }
}

// ─── Mise à jour de l'état de navigation après changement d'onglet ───────────

export function syncUrlBarToTab(url: string, canBack: boolean, canForward: boolean): void {
  const urlbar = document.getElementById('urlbar') as HTMLInputElement;
  urlbar.value = url === 'about:newtab' ? '' : url;
  setNavState(canBack, canForward);
  setBookmarkActive(isBookmarked(settings, url));
  // Met à jour la favicon si disponible
  if (url !== 'about:newtab') {
    const fav = faviconFor(url);
    void fav;
  }
}
