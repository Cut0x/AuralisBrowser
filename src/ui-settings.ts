import { t, setLang, applyAll }               from './i18n.js';
import { applyTheme, setFavoritesBarVisible }  from './ui.js';
import { saveSettings }                        from './storage.js';
import { settings, updateSettings }            from './state.js';
import { browser, tabs }                       from './state.js';
import { renderTabStrip }                      from './ui-tab-strip.js';
import { updateApNavItems, isAuralisPageVisible } from './ui-nav.js';
import { renderFavBar }                        from './ui-favbar.js';
import { renderNewtabFavs }                    from './ui-newtab.js';
import type { BrowserSettings }                from './storage.js';

export function renderAuralisContent(path: string): void {
  const content = document.getElementById('ap-content')!;
  content.innerHTML = ''; updateApNavItems(path);
  switch (path) {
    case 'apparence':  renderPageApparence(content); break;
    case 'moteur':     renderPageMoteur(content);    break;
    case 'demarrage':  renderPageDemarrage(content); break;
    case 'favoris':    import('./ui-settings-data.js').then(({ renderPageFavoris })    => renderPageFavoris(content)); break;
    case 'historique': import('./ui-settings-data.js').then(({ renderPageHistorique }) => renderPageHistorique(content)); break;
    case 'securite':   import('./ui-settings-security.js').then(({ renderPageSecurite }) => renderPageSecurite(content)); break;
    case 'cache':      import('./ui-settings-misc.js').then(({ renderPageCache })      => renderPageCache(content)); break;
    case 'a-propos':   import('./ui-settings-misc.js').then(({ renderPageAPropos })    => renderPageAPropos(content)); break;
    default:           renderPageApparence(content);
  }
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
        <select id="ap-lang" class="setting-select"><option value="fr">Français</option><option value="en">English</option></select></div>
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
  const themeEl = el.querySelector<HTMLSelectElement>('#ap-theme')!;
  const langEl  = el.querySelector<HTMLSelectElement>('#ap-lang')!;
  const favEl   = el.querySelector<HTMLInputElement>('#ap-favbar')!;
  themeEl.value = settings.theme; langEl.value = settings.language; favEl.checked = settings.showFavoritesBar;
  themeEl.addEventListener('change', () => { updateSettings({ ...settings, theme: themeEl.value as BrowserSettings['theme'] }); saveSettings(settings); applyTheme(settings.theme); });
  langEl.addEventListener('change',  () => { updateSettings({ ...settings, language: langEl.value as BrowserSettings['language'] }); saveSettings(settings); setLang(settings.language); applyAll(); renderTabStrip(tabs.getAll(), tabs.getActiveId()); renderFavBar(); renderNewtabFavs(); renderPageApparence(el); });
  favEl.addEventListener('change',   () => { updateSettings({ ...settings, showFavoritesBar: favEl.checked }); saveSettings(settings); setFavoritesBarVisible(settings.showFavoritesBar); void browser.updateBounds(!isAuralisPageVisible()); });
}

function renderPageMoteur(el: HTMLElement): void {
  el.innerHTML = `<h2 class="ap-page-title">${t('settings.moteur')}</h2><div class="ap-group"><div class="ap-group-title">${t('settings.moteur')}</div><div class="ap-row"><label class="ap-label" for="ap-engine">${t('settings.engine')}</label><select id="ap-engine" class="setting-select"><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="brave">Brave Search</option><option value="startpage">Startpage</option></select></div></div>`;
  const engineEl = el.querySelector<HTMLSelectElement>('#ap-engine')!;
  engineEl.value = settings.searchEngine;
  engineEl.addEventListener('change', () => { updateSettings({ ...settings, searchEngine: engineEl.value as BrowserSettings['searchEngine'] }); saveSettings(settings); });
}

function renderPageDemarrage(el: HTMLElement): void {
  const hp = settings.homepage === 'about:newtab' ? '' : settings.homepage;
  el.innerHTML = `<h2 class="ap-page-title">${t('settings.demarrage')}</h2><div class="ap-group"><div class="ap-group-title">${t('settings.homepage_url')}</div><div class="ap-row ap-row--col"><label class="ap-label" for="ap-homepage">${t('settings.homepage_url')}</label><input type="text" id="ap-homepage" class="setting-input" value="${hp.replace(/"/g, '&quot;')}" placeholder="about:newtab"/></div></div>`;
  const hpEl = el.querySelector<HTMLInputElement>('#ap-homepage')!;
  const save = () => { updateSettings({ ...settings, homepage: hpEl.value.trim() || 'about:newtab' }); saveSettings(settings); };
  hpEl.addEventListener('blur', save);
  hpEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}
