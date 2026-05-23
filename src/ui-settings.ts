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
  thumb?: string;
};

export function renderAuralisContent(path: string): void {
  const safePath = normalizePath(path);
  const content = document.getElementById('ap-content')!;
  content.innerHTML = '';
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
      <div class="ahx-hero">
        <div class="ahx-brand">
          <div class="ahx-logo" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 56 56" fill="none">
              <defs>
                <linearGradient id="ahxg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="var(--accent-rose)"/>
                  <stop offset="100%" stop-color="var(--accent-violet)"/>
                </linearGradient>
              </defs>
              <path d="M28 8L44 46H12L28 8z" stroke="url(#ahxg)" stroke-width="2.3" stroke-linejoin="round" fill="none"/>
              <path d="M18 34h20" stroke="url(#ahxg)" stroke-width="2.3" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <h1 class="ahx-title">Auralis</h1>
            <p class="ahx-subtitle">Recherche web et deals PC en direct</p>
          </div>
        </div>

        <form id="ahx-search-form" class="ahx-search" autocomplete="off">
          <input id="ahx-search-input" class="ahx-search-input" type="text"
                 placeholder="Rechercher sur le web..."
                 aria-label="Recherche web Auralis" />
          <button class="ahx-search-btn" type="submit">Rechercher</button>
        </form>
      </div>

      <section class="ahx-deals-wrap">
        <div class="ahx-deals-head">
          <div>
            <h2 class="ahx-deals-title">Deals du moment</h2>
            <p class="ahx-deals-note">Integres via l API CheapShark</p>
          </div>
          <button class="btn-secondary" id="ahx-refresh-deals" type="button">Rafraichir</button>
        </div>
        <div id="ahx-deals-grid" class="ahx-deals-grid" aria-live="polite"></div>
      </section>
    </section>`;

  const form = el.querySelector<HTMLFormElement>('#ahx-search-form')!;
  const input = el.querySelector<HTMLInputElement>('#ahx-search-input')!;
  const refresh = el.querySelector<HTMLButtonElement>('#ahx-refresh-deals')!;
  const grid = el.querySelector<HTMLElement>('#ahx-deals-grid')!;

  const loadDeals = async (title?: string): Promise<void> => {
    grid.innerHTML = '<p class="ahx-loading">Chargement des deals...</p>';
    try {
      const params = new URLSearchParams({
        onSale: '1',
        sortBy: 'DealRating',
        desc: '1',
        pageSize: '24',
      });
      if (title && title.trim()) params.set('title', title.trim());

      const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const deals = await response.json() as CheapDeal[];

      if (!deals.length) {
        grid.innerHTML = '<p class="ahx-loading">Aucun deal trouve.</p>';
        return;
      }

      grid.innerHTML = deals.map(deal => {
        const sale = Number.parseFloat(deal.salePrice || '0');
        const normal = Number.parseFloat(deal.normalPrice || '0');
        const saving = Math.max(0, Math.round(Number.parseFloat(deal.savings || '0')));
        return `
          <article class="ahx-deal-card">
            <img class="ahx-deal-thumb" src="${escapeHtmlAttr(deal.thumb || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
            <div class="ahx-deal-body">
              <h3 class="ahx-deal-title">${escapeHtml(deal.title)}</h3>
              <div class="ahx-deal-prices">
                <strong>${formatUsd(sale)}</strong>
                <span>${formatUsd(normal)}</span>
                <em>-${saving}%</em>
              </div>
              <button class="ahx-deal-btn" data-deal-id="${escapeHtmlAttr(deal.dealID)}" type="button">Voir le deal</button>
            </div>
          </article>`;
      }).join('');

      grid.querySelectorAll<HTMLButtonElement>('.ahx-deal-btn').forEach(btn => {
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
    } catch {
      grid.innerHTML = '<p class="ahx-loading">Impossible de charger les deals pour le moment.</p>';
    }
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) navigate(q);
  });

  refresh.addEventListener('click', () => { void loadDeals(input.value); });
  void loadDeals();
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
  el.innerHTML = `<h2 class="ap-page-title">${t('settings.demarrage')}</h2><div class="ap-group"><div class="ap-group-title">${t('settings.homepage_url')}</div><div class="ap-row ap-row--col"><label class="ap-label" for="ap-homepage">${t('settings.homepage_url')}</label><input type="text" id="ap-homepage" class="setting-input" value="${hp.replace(/"/g, '&quot;')}" placeholder="auralis:home"/></div></div>`;
  const hpEl = el.querySelector<HTMLInputElement>('#ap-homepage')!;
  const save = () => {
    updateSettings({ ...settings, homepage: hpEl.value.trim() || 'auralis:home' });
    saveSettings(settings);
  };
  hpEl.addEventListener('blur', save);
  hpEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
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

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
