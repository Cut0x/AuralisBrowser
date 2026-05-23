import { t, setLang, applyAll } from './i18n.js';

import { applyTheme, setFavoritesBarVisible } from './ui.js';

import { invoke } from '@tauri-apps/api/core';

import { saveSettings } from './storage.js';

import { settings, updateSettings } from './state.js';

import { browser, tabs } from './state.js';

import { renderTabStrip } from './ui-tab-strip.js';

import { isAuralisPageVisible, updateApNavItems, navigate } from './ui-nav.js';

import { renderFavBar } from './ui-favbar.js';

import { renderNewtabFavs } from './ui-newtab.js';

import type { BrowserSettings } from './storage.js';



type PagePath =

  | 'home'

  | 'apparence'

  | 'moteur'

  | 'demarrage'

  | 'favoris'

  | 'historique'

  | 'securite'

  | 'cache'

  | 'a-propos';



type CheapDeal = {

  dealID: string;

  title: string;

  salePrice: string;

  normalPrice: string;

  savings: string;

  dealRating?: string;

  steamRatingPercent?: string;

  steamRatingText?: string;

  storeID?: string;

  thumb?: string;

};

type CheapStore = {

  storeID: string;

  storeName: string;

  isActive: number | string;

};

type DealSort = 'DealRating' | 'Savings' | 'Price' | 'Recent';



const HOME_DEALS_PAGE_SIZE = 24;



export function renderAuralisContent(path: string): void {

  const safePath = normalizePath(path);

  const content = document.getElementById('ap-content')!;

  content.innerHTML = '';

  content.classList.toggle('ap-content--home', safePath === 'home');

  updateApNavItems(safePath);



  switch (safePath) {

    case 'home': renderPageHome(content); break;

    case 'apparence': renderPageApparence(content); break;

    case 'moteur': renderPageMoteur(content); break;

    case 'demarrage': renderPageDemarrage(content); break;

    case 'favoris': import('./ui-settings-data.js').then(({ renderPageFavoris }) => renderPageFavoris(content)); break;

    case 'historique': import('./ui-settings-data.js').then(({ renderPageHistorique }) => renderPageHistorique(content)); break;

    case 'securite': import('./ui-settings-security.js').then(({ renderPageSecurite }) => renderPageSecurite(content)); break;

    case 'cache': import('./ui-settings-misc.js').then(({ renderPageCache }) => renderPageCache(content)); break;

    case 'a-propos': import('./ui-settings-misc.js').then(({ renderPageAPropos }) => renderPageAPropos(content)); break;

    default: renderPageHome(content);

  }

}



function normalizePath(path: string): PagePath {

  const p = path.trim().toLowerCase();

  switch (p) {

    case 'home':

    case 'apparence':

    case 'moteur':

    case 'demarrage':

    case 'favoris':

    case 'historique':

    case 'securite':

    case 'cache':

    case 'a-propos':

      return p;

    default:

      return 'home';

  }

}



function renderPageHome(el: HTMLElement): void {

  el.innerHTML = `

    <section class="ahx-home">



      <!-- HERO -->

      <div class="ahx-hero" aria-label="Auralis Home">

        <div class="ahx-hero-bg" aria-hidden="true">

          <div class="ahx-glow ahx-glow-1"></div>

          <div class="ahx-glow ahx-glow-2"></div>

          <div class="ahx-glow ahx-glow-3"></div>

        </div>

        <div class="ahx-scanlines" aria-hidden="true"></div>

        <div class="ahx-dots"      aria-hidden="true"></div>

        <div class="ahx-hero-content">

          <div class="ahx-brand-row">

            <div class="ahx-emblem" aria-hidden="true">

              <svg width="20" height="20" viewBox="0 0 56 56" fill="none">

                <defs>

                  <linearGradient id="ahxg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">

                    <stop offset="0%" stop-color="var(--accent-rose)"/>

                    <stop offset="100%" stop-color="var(--accent-violet)"/>

                  </linearGradient>

                </defs>

                <path d="M28 8L44 46H12L28 8z" stroke="url(#ahxg)" stroke-width="2.8" stroke-linejoin="round" fill="none"/>

                <path d="M18 34h20" stroke="url(#ahxg)" stroke-width="2.8" stroke-linecap="round"/>

              </svg>

            </div>

            <span class="ahx-brand-kicker">AURALIS · CENTRE</span>

          </div>

          <form id="ahx-search-form" class="ahx-search-bar" autocomplete="off">

            <svg class="ahx-search-ico" width="17" height="17" viewBox="0 0 24 24" fill="none"

                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">

              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>

            </svg>

            <input id="ahx-search-input" class="ahx-search-field" type="text"

                   placeholder="Rechercher sur le web ou entrer une URL..."

                   aria-label="Recherche web Auralis"/>

            <button class="ahx-search-go" type="submit" aria-label="Lancer la recherche">

              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"

                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">

                <line x1="5" y1="12" x2="19" y2="12"/>

                <polyline points="12 5 19 12 12 19"/>

              </svg>

            </button>

          </form>

        </div>

      </div>



      <!-- DEALS PANEL -->

      <div class="ahx-panel">

        <div class="ahx-toolbar">

          <div class="ahx-toolbar-l">

            <h2 class="ahx-panel-title">

              <span class="ahx-accent-pip" aria-hidden="true"></span>

              Deals du moment

            </h2>

            <div class="ahx-stats-row">

              <span class="ahx-chip">

                <span class="ahx-chip-label">DEALS</span>

                <strong class="ahx-chip-val" id="ahx-stat-loaded">0</strong>

              </span>

              <span class="ahx-chip">

                <span class="ahx-chip-label">PAGE</span>

                <strong class="ahx-chip-val" id="ahx-stat-page">—</strong>

              </span>

              <span class="ahx-chip">

                <span class="ahx-chip-label">TRI</span>

                <strong class="ahx-chip-val" id="ahx-stat-sort">Qualité</strong>

              </span>

            </div>

          </div>

          <div class="ahx-toolbar-r">

            <input id="ahx-deals-query" class="ahx-filter-input" type="text"

                   placeholder="Filtrer les jeux..." aria-label="Filtrer les deals"/>

            <div class="ahx-select-wrap">
              <span class="ahx-select-label">Store</span>
              <select id="ahx-store" class="ahx-select">
                <option value="1">Steam (défaut)</option>
                <option value="">Tous les stores</option>
              </select>
            </div>
            <div class="ahx-select-wrap">
              <span class="ahx-select-label">Tri</span>
              <select id="ahx-sort" class="ahx-select">
                <option value="DealRating">Top qualité</option>
                <option value="Savings">Meilleure réduction</option>
                <option value="Price">Prix bas</option>
                <option value="Recent">Récents</option>
              </select>
            </div>

            <button class="ahx-icon-btn" id="ahx-refresh-deals" type="button" aria-label="Actualiser les deals">

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"

                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">

                <polyline points="23 4 23 10 17 10"/>

                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>

              </svg>

            </button>

          </div>

        </div>



        <div id="ahx-deals-grid" class="ahx-deals-grid" aria-live="polite"></div>



        <div class="ahx-panel-foot">

          <p id="ahx-deals-status" class="ahx-status">Chargement...</p>

          <button class="ahx-more-btn" id="ahx-load-more" type="button">
            Charger plus de deals
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <polyline points="5 13 12 20 19 13"/>
            </svg>
          </button>

        </div>

      </div>

    </section>`;



  const form = el.querySelector<HTMLFormElement>('#ahx-search-form')!;

  const input = el.querySelector<HTMLInputElement>('#ahx-search-input')!;

  const dealsQuery = el.querySelector<HTMLInputElement>('#ahx-deals-query')!;

  const storeSelect = el.querySelector<HTMLSelectElement>('#ahx-store')!;

  const sortSelect = el.querySelector<HTMLSelectElement>('#ahx-sort')!;

  const refresh = el.querySelector<HTMLButtonElement>('#ahx-refresh-deals')!;

  const loadMoreBtn = el.querySelector<HTMLButtonElement>('#ahx-load-more')!;

  const status = el.querySelector<HTMLElement>('#ahx-deals-status')!;

  const statLoaded = el.querySelector<HTMLElement>('#ahx-stat-loaded')!;

  const statPage = el.querySelector<HTMLElement>('#ahx-stat-page')!;

  const statSort = el.querySelector<HTMLElement>('#ahx-stat-sort')!;

  const grid = el.querySelector<HTMLElement>('#ahx-deals-grid')!;

  let pageNumber = 0;

  let totalPages = 1;

  let loading = false;

  let currentSort: DealSort = 'DealRating';

  let currentStoreId = '1';



  const sortLabel = (sort: DealSort): string => {

    switch (sort) {

      case 'Savings': return 'Grosse réduction';

      case 'Price': return 'Prix mini';

      case 'Recent': return 'Récents';

      default: return 'Top qualité';

    }

  };



  const updateStats = (): void => {

    const count = grid.querySelectorAll('.ahx-card').length;

    statLoaded.textContent = String(count);

    statPage.textContent = `${Math.min(pageNumber, totalPages)}/${totalPages}`;

    statSort.textContent = sortLabel(currentSort);

  };



  const bindDealButtons = (): void => {

    grid.querySelectorAll<HTMLButtonElement>('.ahx-card-btn:not([data-bound="1"])').forEach(btn => {

      btn.dataset.bound = '1';

      btn.addEventListener('click', async () => {

        const dealId = btn.dataset.dealId;

        if (!dealId) return;

        try {

          const finalUrl = await invoke<string>('resolve_deal_url', { dealId });

          if (finalUrl) {

            navigate(finalUrl);

            return;

          }

        } catch {

          // Fallback handled below.

        }

        navigate(`https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(dealId)}`);

      });

    });

  };



  const dealCardHtml = (deal: CheapDeal): string => {

    const sale   = Number.parseFloat(deal.salePrice  || '0');

    const normal = Number.parseFloat(deal.normalPrice || '0');

    const saving = Math.max(0, Math.round(Number.parseFloat(deal.savings || '0')));

    const rating = Number.parseFloat(deal.dealRating || '0');

    const steamRating = Number.parseInt(deal.steamRatingPercent || '0', 10);

    const isFree = sale === 0 && normal > 0;

    const badge = isFree

      ? '<div class="ahx-badge-free">GRATUIT</div>'

      : saving >= 5 ? `<div class="ahx-badge-discount">-${saving}%</div>` : '';

    return `

      <article class="ahx-card">

        <div class="ahx-card-img-wrap">

          <img class="ahx-card-img" src="${escapeHtmlAttr(deal.thumb || '')}" alt="" loading="lazy"

               onerror="this.closest('.ahx-card-img-wrap').classList.add('ahx-card-no-img');this.style.display='none'">

          ${badge}

        </div>

        <div class="ahx-card-body">

          <h3 class="ahx-card-title">${escapeHtml(deal.title)}</h3>

          <div class="ahx-card-meta">

            <span class="ahx-meta-deal">★ ${Number.isFinite(rating) ? rating.toFixed(1) : '—'}</span>

            <span>${Number.isFinite(steamRating) && steamRating > 0 ? `Steam ${steamRating}%` : '—'}</span>

          </div>

          <div class="ahx-card-price">

            <strong class="ahx-price-now">${isFree ? 'Gratuit' : formatEur(sale)}</strong>

            ${normal > 0 && !isFree ? `<s class="ahx-price-was">${formatEur(normal)}</s>` : ''}

          </div>

          <button class="ahx-card-btn" data-deal-id="${escapeHtmlAttr(deal.dealID)}" type="button">

            Voir l'offre

            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"

                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">

              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>

            </svg>

          </button>

        </div>

      </article>`;

  };



  const setBusy = (isBusy: boolean): void => {

    loading = isBusy;

    refresh.disabled = isBusy;

    sortSelect.disabled = isBusy;

    storeSelect.disabled = isBusy;

    dealsQuery.disabled = isBusy;

    loadMoreBtn.disabled = isBusy;

    if (isBusy) loadMoreBtn.textContent = 'Chargement...';

    else loadMoreBtn.textContent = 'Charger plus de deals';

  };



  const hydrateStores = async (): Promise<void> => {

    try {

      const res = await fetch('https://www.cheapshark.com/api/1.0/stores');

      if (!res.ok) return;

      const stores = (await res.json() as CheapStore[])

        .filter(s => Number(s.isActive) !== 0)

        .sort((a, b) => a.storeName.localeCompare(b.storeName));

      if (!stores.length) return;



      const steam = stores.find(s => s.storeName.toLowerCase().includes('steam'));

      const steamId = steam?.storeID || '1';

      const steamName = steam?.storeName || 'Steam';



      const options: string[] = [

        `<option value="${escapeHtmlAttr(steamId)}">${escapeHtml(`${steamName} (défaut)`)}</option>`,

        '<option value="">Tous les stores</option>',

      ];

      for (const store of stores) {

        if (store.storeID === steamId) continue;

        options.push(`<option value="${escapeHtmlAttr(store.storeID)}">${escapeHtml(store.storeName)}</option>`);

      }



      storeSelect.innerHTML = options.join('');

      if (!currentStoreId) currentStoreId = steamId;

      storeSelect.value = currentStoreId;

      if (storeSelect.value !== currentStoreId) {

        currentStoreId = steamId;

        storeSelect.value = currentStoreId;

      }

    } catch {

      // Keep fallback values.

    }

  };



  const loadDeals = async (opts?: { reset?: boolean }): Promise<void> => {

    if (loading) return;

    const reset = !!opts?.reset;

    if (reset) {

      pageNumber = 0;

      totalPages = 1;

      grid.innerHTML = '';

      status.textContent = 'Chargement des deals...';

    }

    if (pageNumber >= totalPages && !reset) return;



    setBusy(true);

    try {

      const params = new URLSearchParams({

        onSale: '1',

        steamworks: '1',

        sortBy: currentSort,

        desc: currentSort === 'Price' ? '0' : '1',

        pageSize: String(HOME_DEALS_PAGE_SIZE),

        pageNumber: String(pageNumber),

      });

      if (currentStoreId) params.set('storeID', currentStoreId);

      const title = dealsQuery.value.trim();

      if (title) params.set('title', title);



      const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?${params.toString()}`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const totalHeader = Number.parseInt(response.headers.get('x-total-page-count') || '1', 10);

      if (Number.isFinite(totalHeader) && totalHeader > 0) totalPages = totalHeader;

      const deals = await response.json() as CheapDeal[];



      if (!deals.length) {

        if (pageNumber === 0) {

          grid.innerHTML = '<p class="ahx-loading-msg">Aucun deal trouvé pour ce filtre.</p>';

          status.textContent = 'Aucun résultat';

          loadMoreBtn.style.display = 'none';

        } else {

          status.textContent = 'Fin de la liste';

        }

        updateStats();

        return;

      }



      grid.insertAdjacentHTML('beforeend', deals.map(dealCardHtml).join(''));

      bindDealButtons();

      pageNumber += 1;



      const shown = grid.querySelectorAll('.ahx-card').length;

      status.textContent = `${shown} deals affichés - page ${pageNumber}/${totalPages}`;

      loadMoreBtn.style.display = pageNumber < totalPages ? 'inline-flex' : 'none';

      updateStats();

    } catch {

      if (!grid.querySelector('.ahx-card')) {

        grid.innerHTML = '<p class="ahx-loading-msg">Impossible de charger les deals pour le moment.</p>';

      }

      status.textContent = 'Erreur réseau, réessaie.';

    } finally {

      setBusy(false);

    }

  };



  form.addEventListener('submit', e => {

    e.preventDefault();

    const q = input.value.trim();

    if (q) navigate(q);

  });



  refresh.addEventListener('click', () => { void loadDeals({ reset: true }); });

  loadMoreBtn.addEventListener('click', () => { void loadDeals(); });

  storeSelect.addEventListener('change', () => {

    currentStoreId = storeSelect.value || '';

    void loadDeals({ reset: true });

  });

  sortSelect.addEventListener('change', () => {

    currentSort = (sortSelect.value || 'DealRating') as DealSort;

    void loadDeals({ reset: true });

  });

  dealsQuery.addEventListener('keydown', e => {

    if (e.key === 'Enter') {

      e.preventDefault();

      void loadDeals({ reset: true });

    }

  });



  updateStats();

  void hydrateStores();

  void loadDeals({ reset: true });

}



function renderPageApparence(el: HTMLElement): void {

  el.innerHTML = `

    <h2 class="ap-page-title">${t('settings.apparence')}</h2>

    <div class="ap-group">

      <div class="ap-group-title">${t('settings.apparence')}</div>

      <div class="ap-row"><label class="ap-label" for="ap-theme">${t('settings.theme')}</label>

        <select id="ap-theme" class="setting-select">

          <option value="dark">${t('settings.theme_dark')}</option>

          <option value="light">${t('settings.theme_light')}</option>

          <option value="midnight">${t('settings.theme_midnight')}</option>

        </select></div>

      <div class="ap-row"><label class="ap-label" for="ap-lang">${t('settings.language')}</label>

        <select id="ap-lang" class="setting-select"><option value="fr">Francais</option><option value="en">English</option></select></div>

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

        <div class="ap-shortcut-row"><kbd>Alt+<-</kbd><span>Precedent</span></div>

        <div class="ap-shortcut-row"><kbd>Alt+-></kbd><span>Suivant</span></div>

      </div>

    </div>`;



  const themeEl = el.querySelector<HTMLSelectElement>('#ap-theme')!;

  const langEl = el.querySelector<HTMLSelectElement>('#ap-lang')!;

  const favEl = el.querySelector<HTMLInputElement>('#ap-favbar')!;

  themeEl.value = settings.theme;

  langEl.value = settings.language;

  favEl.checked = settings.showFavoritesBar;



  themeEl.addEventListener('change', () => {

    updateSettings({ ...settings, theme: themeEl.value as BrowserSettings['theme'] });

    saveSettings(settings);

    applyTheme(settings.theme);

  });



  langEl.addEventListener('change', () => {

    updateSettings({ ...settings, language: langEl.value as BrowserSettings['language'] });

    saveSettings(settings);

    setLang(settings.language);

    applyAll();

    renderTabStrip(tabs.getAll(), tabs.getActiveId());

    renderFavBar();

    renderNewtabFavs();

    renderPageApparence(el);

  });



  favEl.addEventListener('change', () => {

    updateSettings({ ...settings, showFavoritesBar: favEl.checked });

    saveSettings(settings);

    setFavoritesBarVisible(settings.showFavoritesBar);

    void browser.updateBounds(!isAuralisPageVisible());

  });

}



function renderPageMoteur(el: HTMLElement): void {

  el.innerHTML = `<h2 class="ap-page-title">${t('settings.moteur')}</h2><div class="ap-group"><div class="ap-group-title">${t('settings.moteur')}</div><div class="ap-row"><label class="ap-label" for="ap-engine">${t('settings.engine')}</label><select id="ap-engine" class="setting-select"><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="brave">Brave Search</option><option value="startpage">Startpage</option></select></div></div>`;

  const engineEl = el.querySelector<HTMLSelectElement>('#ap-engine')!;

  engineEl.value = settings.searchEngine;

  engineEl.addEventListener('change', () => {

    updateSettings({ ...settings, searchEngine: engineEl.value as BrowserSettings['searchEngine'] });

    saveSettings(settings);

  });

}



function renderPageDemarrage(el: HTMLElement): void {

  const hp = settings.homepage === 'about:newtab' ? '' : settings.homepage;
  const maxLiveTabs = Number.isFinite(settings.maxLiveTabs) ? settings.maxLiveTabs : 3;

  el.innerHTML = `<h2 class="ap-page-title">${t('settings.demarrage')}</h2><div class="ap-group"><div class="ap-group-title">${t('settings.homepage_url')}</div><div class="ap-row ap-row--col"><label class="ap-label" for="ap-homepage">${t('settings.homepage_url')}</label><input type="text" id="ap-homepage" class="setting-input" value="${hp.replace(/"/g, '&quot;')}" placeholder="auralis:home"/></div><div class="ap-row ap-row--col"><label class="ap-label" for="ap-max-live-tabs">Onglets gardes en memoire (1-12)</label><input type="number" id="ap-max-live-tabs" class="setting-input" min="1" max="12" step="1" value="${maxLiveTabs}"/></div></div>`;

  const hpEl = el.querySelector<HTMLInputElement>('#ap-homepage')!;
  const maxLiveTabsEl = el.querySelector<HTMLInputElement>('#ap-max-live-tabs')!;

  const save = () => {
    const parsed = Number.parseInt(maxLiveTabsEl.value || '', 10);
    const safeMaxLiveTabs = Number.isFinite(parsed) ? Math.max(1, Math.min(12, parsed)) : 3;
    maxLiveTabsEl.value = String(safeMaxLiveTabs);

    updateSettings({ ...settings, homepage: hpEl.value.trim() || 'auralis:home' });
    updateSettings({ ...settings, maxLiveTabs: safeMaxLiveTabs });

    saveSettings(settings);
    browser.setMaxLiveTabs(safeMaxLiveTabs);

  };

  hpEl.addEventListener('blur', save);

  hpEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  maxLiveTabsEl.addEventListener('blur', save);
  maxLiveTabsEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

}



function escapeHtml(s: string): string {

  return s

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#39;');

}



function escapeHtmlAttr(s: string): string {

  return escapeHtml(s || '');

}



const USD_EUR_RATE = 0.92;

function formatEur(usd: number): string {
  if (!Number.isFinite(usd)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(usd * USD_EUR_RATE);
}

