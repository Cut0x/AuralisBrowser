/**
 * ui-settings-misc.ts - Pages Paramètres : Cache & Données, À propos.
 */

import { invoke }                                   from '@tauri-apps/api/core';
import { t }                                        from './i18n.js';
import { toast }                                    from './ui.js';
import { saveSettings, getLocalStorageSize }        from './storage.js';
import { countBookmarkLinks }                       from './bookmarks-store.js';
import { browser, settings, updateSettings }        from './state.js';
import { renderFavBar }                             from './ui-favbar.js';
import { renderNewtabFavs }                         from './ui-newtab.js';

// ─── Page Cache & Données ─────────────────────────────────────────────────────

export function renderPageCache(el: HTMLElement): void {
  const { used, quota } = getLocalStorageSize();
  const usedKB  = (used  / 1024).toFixed(1);
  const quotaMB = (quota / (1024 * 1024)).toFixed(0);
  const pct     = Math.min(100, (used / quota) * 100).toFixed(1);
  const barColor = parseFloat(pct) > 80 ? 'var(--accent-rose)' : parseFloat(pct) > 50 ? '#f0c060' : 'var(--accent-violet)';

  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.cache')}</h2>
    <div class="ap-group" style="max-width:560px">
      <div class="ap-group-title">Memoire (mode GX)</div>
      <div class="ap-row">
        <label class="ap-label" for="ap-ram-mode">Gestion des onglets inactifs</label>
        <select id="ap-ram-mode" class="setting-select">
          <option value="aggressive">GX Ultra (RAM minimale)</option>
          <option value="balanced">GX Balanced</option>
          <option value="off">Off (compatibilite max)</option>
        </select>
      </div>
      <p id="ap-ram-hint" style="font-size:12px;color:var(--text-muted);margin-top:8px"></p>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-outline" id="ap-ram-purge">Liberer la RAM maintenant</button>
      </div>
    </div>
    <div class="ap-group" style="max-width:560px">
      <div class="ap-group-title">Stockage local</div>
      <div class="storage-bar-wrap">
        <div class="storage-bar-labels"><span>${usedKB} Ko utilisés</span><span>${pct}% · quota ${quotaMB} Mo</span></div>
        <div class="storage-bar-track"><div class="storage-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="storage-bar-breakdown">
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:var(--accent-violet)"></span><span>Favoris (${countBookmarkLinks(settings.bookmarks)} liens)</span></div>
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:#f0c060"></span><span>Historique (${settings.history.length} entrées)</span></div>
          <div class="storage-breakdown-item"><span class="sbi-dot" style="background:var(--accent-rose)"></span><span>Mots de passe (${settings.passwords.length})</span></div>
        </div>
      </div>
    </div>
    <div class="ap-group" style="max-width:560px;margin-top:16px">
      <div class="ap-group-title">Effacer les données</div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Sélectionnez les catégories à supprimer définitivement.</p>
      <div class="clear-cat-list">
        <label class="clear-cat-item"><input type="checkbox" id="chk-hist" checked>
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#f0c060" stroke-width="1.1"/><path d="M7 4v3l2 2" stroke="#f0c060" stroke-width="1.1" stroke-linecap="round"/></svg>Historique de navigation</span>
          <span class="clear-cat-count">${settings.history.length} entrées</span></label>
        <label class="clear-cat-item"><input type="checkbox" id="chk-bookmarks">
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3z" fill="var(--accent-violet)" opacity=".7"/></svg>Favoris &amp; dossiers</span>
          <span class="clear-cat-count">${countBookmarkLinks(settings.bookmarks)} liens</span></label>
        <label class="clear-cat-item"><input type="checkbox" id="chk-passwords">
          <span class="clear-cat-label"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1" stroke="var(--accent-rose)" stroke-width="1.1"/><path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="var(--accent-rose)" stroke-width="1.1" stroke-linecap="round"/></svg>Mots de passe enregistrés</span>
          <span class="clear-cat-count">${settings.passwords.length}</span></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn-outline" id="ap-clear-selected" style="color:var(--accent-rose)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 3h10M4 3V2h5v1M2.5 3l.75 8h5.5l.75-8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          Effacer la sélection
        </button>
        <button class="btn-outline" id="ap-clear-all" style="color:var(--accent-rose);opacity:.7;font-size:12px">Tout effacer</button>
      </div>
    </div>`;

  const chkHist = el.querySelector<HTMLInputElement>('#chk-hist')!;
  const chkBm   = el.querySelector<HTMLInputElement>('#chk-bookmarks')!;
  const chkPw   = el.querySelector<HTMLInputElement>('#chk-passwords')!;
  const ramModeEl = el.querySelector<HTMLSelectElement>('#ap-ram-mode')!;
  const ramHintEl = el.querySelector<HTMLElement>('#ap-ram-hint')!;
  const ramPurgeEl = el.querySelector<HTMLButtonElement>('#ap-ram-purge')!;

  const ramHint = (mode: string): string => {
    if (mode === 'off') return 'Aucune fermeture automatique des WebViews en arriere-plan.';
    if (mode === 'balanced') return 'Garde l onglet actif + 1 WebView recente en fond. Bon compromis RAM/stabilite.';
    return 'Mode Opera GX: un seul onglet garde sa WebView. Les autres sont hibernes automatiquement.';
  };

  ramModeEl.value = settings.ramMode;
  ramHintEl.textContent = ramHint(settings.ramMode);

  ramModeEl.addEventListener('change', () => {
    const nextMode = (ramModeEl.value === 'off' || ramModeEl.value === 'balanced')
      ? ramModeEl.value
      : 'aggressive';
    updateSettings({ ...settings, ramMode: nextMode });
    saveSettings(settings);
    browser.setMemorySaverMode(settings.ramMode);
    ramHintEl.textContent = ramHint(settings.ramMode);
    toast(`Mode RAM: ${settings.ramMode}`);
  });

  ramPurgeEl.addEventListener('click', async () => {
    ramPurgeEl.disabled = true;
    try {
      const closed = await browser.freeBackgroundMemory();
      toast(`Memoire liberee: ${closed} WebView(s) dechargee(s).`, 'success');
    } catch (err) {
      toast('Echec de la liberation memoire. Voir console Auralis.', 'error');
      console.error(err);
    } finally {
      ramPurgeEl.disabled = false;
    }
  });

  const doClear = (hist: boolean, bm: boolean, pw: boolean) => {
    const parts = [hist && 'historique', bm && 'favoris', pw && 'mots de passe'].filter(Boolean);
    if (!parts.length || !confirm(`Effacer ${parts.join(', ')} ?`)) return;
    if (hist) updateSettings({ ...settings, history:   [] });
    if (bm)   updateSettings({ ...settings, bookmarks: [] });
    if (pw)   updateSettings({ ...settings, passwords: [] });
    saveSettings(settings);
    if (bm) { renderFavBar(); renderNewtabFavs(); }
    toast('Données effacées'); renderPageCache(el);
  };

  el.querySelector('#ap-clear-selected')!.addEventListener('click', () => doClear(chkHist.checked, chkBm.checked, chkPw.checked));
  el.querySelector('#ap-clear-all')!.addEventListener('click', () => doClear(true, true, true));
}

// ─── Page À propos ────────────────────────────────────────────────────────────

export function renderPageAPropos(el: HTMLElement): void {
  invoke<string>('get_version').then(version => {
    el.innerHTML = `
      <h2 class="ap-page-title">${t('settings.a_propos')}</h2>
      <div class="ap-group" style="max-width:480px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <svg width="38" height="38" viewBox="0 0 56 56" fill="none">
            <defs><linearGradient id="abg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--accent-rose)"/><stop offset="100%" stop-color="var(--accent-violet)"/></linearGradient></defs>
            <path d="M28 8L44 46H12L28 8z" stroke="url(#abg)" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
            <path d="M18 34h20" stroke="url(#abg)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <div>
            <div class="ap-about-name">Auralis</div>
            <div class="ap-about-ver">v${esc(version)}</div>
          </div>
        </div>
        <div class="ap-about-line">${t('about.stack')}</div>
        <div class="ap-about-line">${t('about.license')}</div>
        <div style="margin-top:12px">
          <a href="#" id="ap-site-link" class="btn-outline" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;margin-right:8px">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.1"/><path d="M7 2c0 0-1.5 2-1.5 5S7 12 7 12m0-10c0 0 1.5 2 1.5 5S7 12 7 12M2 7h10" stroke="currentColor" stroke-width="1.1"/></svg>
            Site officiel
          </a>
          <a href="#" id="ap-github-link" class="btn-outline" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </a>
        </div>
        <div style="margin-top:16px;padding:12px 14px;background:var(--bg-2);border-radius:var(--r-md);border:1px solid var(--glass-border);display:flex;align-items:center;gap:10px">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="flex-shrink:0">
            <path d="M8 1.5l1.75 3.54 3.9.57-2.82 2.75.66 3.88L8 10.27l-3.49 1.97.66-3.88L2.35 5.6l3.9-.57L8 1.5z" stroke="var(--accent-gold,#f0c060)" stroke-width="1.2" stroke-linejoin="round" fill="var(--accent-gold,#f0c060)" fill-opacity=".25"/>
          </svg>
          <div style="flex:1;min-width:0">
            <p style="font-size:12.5px;font-weight:500;color:var(--text-primary)">Vous aimez Auralis ?</p>
            <p style="font-size:11.5px;color:var(--text-muted);margin-top:3px">Laissez une ⭐ sur GitHub - c'est gratuit et ça aide beaucoup !</p>
          </div>
          <a href="#" id="ap-star-link" class="btn-outline" style="flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;text-decoration:none;font-size:12px">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5l1.75 3.54 3.9.57-2.82 2.75.66 3.88L8 10.27l-3.49 1.97.66-3.88L2.35 5.6l3.9-.57L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            Star
          </a>
        </div>
      </div>`;
    el.querySelector('#ap-site-link')!.addEventListener('click', e => {
      e.preventDefault();
      import('@tauri-apps/plugin-opener').then(({ openUrl }) =>
        openUrl('https://auralisbrowser.fr').catch(console.error));
    });
    el.querySelector('#ap-github-link')!.addEventListener('click', e => {
      e.preventDefault();
      import('@tauri-apps/plugin-opener').then(({ openUrl }) =>
        openUrl('https://github.com/Cut0x/AuralisBrowser').catch(console.error));
    });
    el.querySelector('#ap-star-link')!.addEventListener('click', e => {
      e.preventDefault();
      import('@tauri-apps/plugin-opener').then(({ openUrl }) =>
        openUrl('https://github.com/Cut0x/AuralisBrowser').catch(console.error));
    });
  }).catch(() => {
    el.innerHTML = `<h2 class="ap-page-title">${t('settings.a_propos')}</h2><p style="color:var(--text-muted)">Auralis v0.2.2</p>`;
  });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
