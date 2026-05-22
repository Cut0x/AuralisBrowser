import { t }                                from './i18n.js';
import { toast }                           from './ui.js';
import { saveSettings }                    from './storage.js';
import { savePassword }                    from './passwords.js';
import { settings, updateSettings }        from './state.js';
import { renderPasswordList }              from './ui-passwords.js';

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
