import { t }                              from './i18n.js';
import { toast }                          from './ui.js';
import { saveSettings }                   from './storage.js';
import { savePassword, extractDomain,
         findForDomain }                  from './passwords.js';
import { browser, settings, updateSettings } from './state.js';
import { showAuralisPage }                from './ui-nav.js';
import { closePwPanel }                   from './ui-passwords.js';

export function initPasswordHandlers(): void {
  document.getElementById('btn-passwords')?.addEventListener('click', () => showAuralisPage('auralis::settings/securite'));
  document.getElementById('btn-close-pw')?.addEventListener('click', closePwPanel);
  document.getElementById('pw-backdrop')?.addEventListener('click', closePwPanel);

  document.getElementById('btn-pw-save-confirm')?.addEventListener('click', async () => {
    const pwUser = document.getElementById('pw-username-input') as HTMLInputElement;
    const pwPass = document.getElementById('pw-password-input') as HTMLInputElement;
    const domain = extractDomain(browser.currentUrl());
    const username = pwUser.value.trim(), password = pwPass.value;
    if (!password) return;
    updateSettings({ ...settings, passwords: await savePassword(settings.passwords, domain, username, password) });
    saveSettings(settings);
    document.getElementById('pw-save-prompt')?.classList.add('hidden');
    pwUser.value = ''; pwPass.value = '';
    toast(t('toast.pw_saved'), 'success');
  });

  document.getElementById('btn-pw-save-cancel')?.addEventListener('click', () => {
    document.getElementById('pw-save-prompt')?.classList.add('hidden');
    (document.getElementById('pw-username-input') as HTMLInputElement).value = '';
    (document.getElementById('pw-password-input') as HTMLInputElement).value = '';
  });

  document.getElementById('btn-show-pw-prompt')?.addEventListener('click', () => {
    const url = browser.currentUrl();
    if (!url || url === 'about:newtab') return;
    const matches = findForDomain(settings.passwords, url);
    if (matches.length > 0) {
      (document.getElementById('pw-username-input') as HTMLInputElement).value = matches[0].username ?? '';
    }
    document.getElementById('pw-save-prompt')?.classList.remove('hidden');
    document.getElementById('pw-username-input')?.focus();
  });
}
