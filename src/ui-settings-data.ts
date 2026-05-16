/**
 * ui-settings-data.ts — Pages Paramètres : Favoris, Historique, Sécurité.
 */

import { t }                                                   from './i18n.js';
import { toast, faviconFor }                                   from './ui.js';
import { saveSettings }                                        from './storage.js';
import { addFolder, mergeBookmarks, countBookmarkLinks }       from './bookmarks-store.js';
import { savePassword }                                        from './passwords.js';
import { parseNetscapeBookmarks, openFileDialog, exportBookmarks } from './import.js';
import { settings, updateSettings }                            from './state.js';
import { navigate, hideAuralisPage }                           from './ui-nav.js';
import { renderFavBar }                                        from './ui-favbar.js';
import { renderNewtabFavs }                                    from './ui-newtab.js';
import { renderBmTree }                                        from './ui-bm-tree.js';
import { renderPasswordList }                                  from './ui-passwords.js';

// ─── Page Favoris ─────────────────────────────────────────────────────────────

export function renderPageFavoris(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.favoris')}</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn-outline" id="ap-bm-new-folder">${t('settings.new_folder')}</button>
      <button class="btn-outline" id="ap-bm-import">${t('settings.import_btn')}</button>
      <button class="btn-outline" id="ap-bm-export">${t('settings.export_btn')}</button>
    </div>
    <div id="ap-bm-tree" class="bm-tree"></div>`;

  renderBmTree(el.querySelector<HTMLElement>('#ap-bm-tree')!, settings.bookmarks, 0);

  el.querySelector('#ap-bm-new-folder')!.addEventListener('click', async () => {
    const name = prompt('Nom du dossier :');
    if (!name) return;
    updateSettings(addFolder(settings, name.trim()));
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    renderPageFavoris(el); toast(t('toast.folder_created'), 'success');
  });

  el.querySelector('#ap-bm-import')!.addEventListener('click', async () => {
    const html = await openFileDialog('.html,.htm'); if (!html) return;
    const imported = parseNetscapeBookmarks(html);
    updateSettings(mergeBookmarks(settings, imported));
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    renderPageFavoris(el); toast(`${t('toast.imported')} (${countBookmarkLinks(imported)})`, 'success');
  });

  el.querySelector('#ap-bm-export')!.addEventListener('click', () => exportBookmarks(settings.bookmarks));
}

// ─── Page Historique ──────────────────────────────────────────────────────────

export function renderPageHistorique(el: HTMLElement): void {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 class="ap-page-title" style="margin:0">${t('settings.historique')}</h2>
      <button class="btn-outline" id="ap-clear-hist" style="color:var(--accent-rose)">${t('settings.clear_history')}</button>
    </div>
    <div id="ap-hist-list"></div>`;

  const listEl = el.querySelector<HTMLElement>('#ap-hist-list')!;
  renderHistList(listEl);

  el.querySelector('#ap-clear-hist')!.addEventListener('click', () => {
    if (!confirm(t('settings.clear_confirm'))) return;
    updateSettings({ ...settings, history: [] });
    saveSettings(settings); renderHistList(listEl); toast(t('toast.history_cleared'));
  });
}

function renderHistList(listEl: HTMLElement): void {
  listEl.innerHTML = '';
  if (settings.history.length === 0) {
    listEl.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:16px 0">Aucun historique.</p>`; return;
  }
  const groups = new Map<string, typeof settings.history>();
  for (const entry of settings.history.slice(0, 200)) {
    const d = new Date(entry.visitedAt), today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const label = d.toDateString() === today.toDateString() ? "Aujourd'hui"
      : d.toDateString() === yesterday.toDateString() ? 'Hier'
      : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  groups.forEach((entries, label) => {
    const dateEl = document.createElement('div');
    dateEl.className = 'history-group-date'; dateEl.textContent = label;
    listEl.appendChild(dateEl);
    for (const entry of entries) {
      const time = new Date(entry.visitedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const row = document.createElement('div'); row.className = 'history-item';
      row.innerHTML = `
        <span class="history-item-time">${time}</span>
        <img class="history-item-icon" src="${faviconFor(entry.url)}" width="16" height="16" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="history-item-info">
          <div class="history-item-title">${esc(entry.title || entry.url)}</div>
          <div class="history-item-url">${esc(entry.url)}</div>
        </div>
        <button class="history-item-del" data-id="${entry.id}" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>`;
      row.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('.history-item-del')) return;
        hideAuralisPage(); navigate(entry.url);
      });
      row.querySelector('.history-item-del')!.addEventListener('click', e => {
        e.stopPropagation();
        updateSettings({ ...settings, history: settings.history.filter(h => h.id !== entry.id) });
        saveSettings(settings); row.remove();
      });
      listEl.appendChild(row);
    }
  });
}

// ─── Page Sécurité (mots de passe) ───────────────────────────────────────────

export function renderPageSecurite(el: HTMLElement): void {
  el.innerHTML = `
    <h2 class="ap-page-title">${t('settings.securite')}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${t('settings.passwords_hint')}</p>
    <button class="btn-outline" id="ap-pw-add-btn" style="margin-bottom:14px;display:inline-flex;align-items:center;gap:6px">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Ajouter manuellement
    </button>
    <div id="ap-pw-add-form" class="pw-add-form" style="display:none;max-width:560px;margin-bottom:14px">
      <div class="pw-add-row">
        <input type="text"     id="ap-pw-f-domain" class="setting-input" placeholder="Domaine (ex: github.com)" autocomplete="off"/>
        <input type="text"     id="ap-pw-f-user"   class="setting-input" placeholder="Identifiant / Email" autocomplete="off"/>
        <input type="password" id="ap-pw-f-pass"   class="setting-input" placeholder="Mot de passe"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-primary"   id="ap-pw-f-ok">Enregistrer</button>
        <button class="btn-secondary" id="ap-pw-f-cancel">Annuler</button>
      </div>
    </div>
    <div id="ap-pw-list" class="pw-list" style="max-width:560px"></div>`;

  const addForm = el.querySelector<HTMLElement>('#ap-pw-add-form')!;
  const fDomain = el.querySelector<HTMLInputElement>('#ap-pw-f-domain')!;
  const fUser   = el.querySelector<HTMLInputElement>('#ap-pw-f-user')!;
  const fPass   = el.querySelector<HTMLInputElement>('#ap-pw-f-pass')!;

  el.querySelector('#ap-pw-add-btn')!.addEventListener('click', () => { addForm.style.display = ''; fDomain.focus(); });
  el.querySelector('#ap-pw-f-cancel')!.addEventListener('click', () => {
    addForm.style.display = 'none'; fDomain.value = ''; fUser.value = ''; fPass.value = '';
  });
  el.querySelector('#ap-pw-f-ok')!.addEventListener('click', async () => {
    const domain = fDomain.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const user = fUser.value.trim(), pass = fPass.value;
    if (!domain || !user || !pass) { toast('Remplissez tous les champs'); return; }
    updateSettings({ ...settings, passwords: await savePassword(settings.passwords, domain, user, pass) });
    saveSettings(settings); addForm.style.display = 'none';
    fDomain.value = ''; fUser.value = ''; fPass.value = '';
    renderPasswordList(el.querySelector<HTMLElement>('#ap-pw-list')!);
    toast(t('toast.pw_saved'), 'success');
  });
  renderPasswordList(el.querySelector<HTMLElement>('#ap-pw-list')!);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
