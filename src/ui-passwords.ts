/**
 * ui-passwords.ts - Panneau de gestion des mots de passe et prompt de sauvegarde.
 *
 * Le panneau MDP utilise browser.parkForOverlay() / restoreFromOverlay() pour
 * masquer la webview native pendant son affichage.
 */

import { t }                              from './i18n.js';
import { toast }                          from './ui.js';
import { saveSettings }                   from './storage.js';
import { decryptPassword, deletePassword,
         findForDomain }                  from './passwords.js';
import { browser, settings, updateSettings } from './state.js';

// ─── Indicateur MDP dans la barre d'adresse ──────────────────────────────────

export function checkPasswordIndicator(url: string): void {
  const matches = findForDomain(settings.passwords, url);
  document.getElementById('pw-indicator')?.classList.toggle('has-saved', matches.length > 0);
}

export async function tryAutofillPassword(url: string): Promise<void> {
  const matches = findForDomain(settings.passwords, url);
  if (matches.length === 0) return;
  const entry = matches[0];
  const plain = await decryptPassword(entry).catch(() => '');
  if (!plain) return;

  const u = JSON.stringify(entry.username ?? '');
  const p = JSON.stringify(plain);
  const js = `(function(){
    try{
      var user=${u}, pass=${p};
      var pw=document.querySelector('input[type="password"]');
      if(!pw) return;
      var uf=document.querySelector('input[type="email"],input[type="text"],input[name*="user" i],input[name*="email" i],input[name*="login" i],input[id*="user" i],input[id*="email" i],input[id*="login" i],input[autocomplete*="username" i],input[autocomplete*="email" i]');
      if(uf && !uf.value && user){ uf.value=user; uf.dispatchEvent(new Event('input',{bubbles:true})); uf.dispatchEvent(new Event('change',{bubbles:true})); }
      if(!pw.value){ pw.value=pass; pw.dispatchEvent(new Event('input',{bubbles:true})); pw.dispatchEvent(new Event('change',{bubbles:true})); }
    }catch{}
  })();`;
  browser.eval(js);
}

// ─── Liste des mots de passe ─────────────────────────────────────────────────

export function renderPasswordList(container: HTMLElement): void {
  container.innerHTML = '';
  if (settings.passwords.length === 0) {
    container.innerHTML = `<p class="pw-empty">${t('pw.no_saved')}</p>`; return;
  }

  for (const pw of settings.passwords) {
    const row = document.createElement('div');
    row.className = 'pw-row';
    row.innerHTML = `
      <div class="pw-info">
        <span class="pw-domain">${esc(pw.domain)}</span>
        <span class="pw-user">${esc(pw.username)}</span>
      </div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-copy" data-id="${pw.id}" title="${t('pw.fill')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="1" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.1" fill="var(--bg-1)"/></svg>
        </button>
        <button class="pw-btn pw-btn-delete" data-id="${pw.id}" title="${t('pw.delete')}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M3 3.5l.75 8h6.5l.75-8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    container.appendChild(row);
  }

  container.querySelectorAll('.pw-btn-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      const pw = settings.passwords.find(p => p.id === id);
      if (!pw) return;
      const plain = await decryptPassword(pw);
      navigator.clipboard.writeText(plain).then(() => toast(t('toast.copied'), 'success'));
    });
  });

  container.querySelectorAll('.pw-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      updateSettings({ ...settings, passwords: deletePassword(settings.passwords, id) });
      saveSettings(settings);
      renderPasswordList(container);
      toast(t('toast.pw_deleted'));
    });
  });
}

// ─── Panneau MDP (slide-in) ──────────────────────────────────────────────────

export function openPwPanel(): void {
  const pwPanel = document.getElementById('pw-panel')!;
  const pwList  = document.getElementById('pw-list')!;
  browser.parkForOverlay(); // la webview doit être masquée pour voir le panneau
  renderPasswordList(pwList);
  pwPanel.classList.remove('hidden');
  requestAnimationFrame(() => pwPanel.classList.add('is-open'));
}

export function closePwPanel(): void {
  const pwPanel = document.getElementById('pw-panel')!;
  pwPanel.classList.remove('is-open');
  pwPanel.addEventListener('transitionend', () => {
    pwPanel.classList.add('hidden');
    browser.restoreFromOverlay(); // restaure la webview après l'animation
  }, { once: true });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
