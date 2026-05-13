// Settings panel controller — reads form state, emits a patch on save.

import type { BrowserSettings } from './storage.js';
import type { Lang }            from './i18n.js';
import { t }                    from './i18n.js';

type SaveHandler = (patch: Partial<BrowserSettings>) => void;

export class SettingsPanel {
  private panel:     HTMLElement;
  private backdrop:  HTMLElement;
  private theme:     HTMLSelectElement;
  private engine:    HTMLSelectElement;
  private lang:      HTMLSelectElement;
  private homepage:  HTMLInputElement;
  private favbarCb:  HTMLInputElement;
  private saveBtn:   HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private closeBtn:  HTMLButtonElement;
  private onSave:    SaveHandler;

  constructor(onSave: SaveHandler) {
    this.panel    = document.getElementById('settings-panel')!;
    this.backdrop = document.getElementById('settings-backdrop')!;
    this.theme    = document.getElementById('setting-theme')    as HTMLSelectElement;
    this.engine   = document.getElementById('setting-engine')   as HTMLSelectElement;
    this.lang     = document.getElementById('setting-lang')     as HTMLSelectElement;
    this.homepage = document.getElementById('setting-homepage') as HTMLInputElement;
    this.favbarCb = document.getElementById('setting-favbar')   as HTMLInputElement;
    this.saveBtn  = document.getElementById('btn-save-settings')   as HTMLButtonElement;
    this.cancelBtn= document.getElementById('btn-cancel-settings') as HTMLButtonElement;
    this.closeBtn = document.getElementById('btn-close-settings')  as HTMLButtonElement;
    this.onSave   = onSave;

    this.saveBtn.addEventListener('click',  () => this.save());
    this.cancelBtn.addEventListener('click',() => this.hide());
    this.closeBtn.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.panel.classList.contains('hidden')) this.hide();
    });
  }

  show(current: BrowserSettings): void {
    this.theme.value    = current.theme;
    this.engine.value   = current.searchEngine;
    this.lang.value     = current.language;
    this.homepage.value = current.homepage === 'about:newtab' ? '' : current.homepage;
    this.favbarCb.checked = current.showFavoritesBar;

    this.panel.classList.remove('hidden');
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.closeBtn.focus();
  }

  hide(): void {
    this.panel.classList.remove('is-open');
    this.panel.addEventListener('transitionend', () => this.panel.classList.add('hidden'), { once: true });
  }

  private save(): void {
    this.onSave({
      theme:            this.theme.value    as BrowserSettings['theme'],
      searchEngine:     this.engine.value   as BrowserSettings['searchEngine'],
      language:         this.lang.value     as Lang,
      homepage:         this.homepage.value.trim() || 'about:newtab',
      showFavoritesBar: this.favbarCb.checked,
    });
    this.hide();
  }

  updateTexts(): void {
    // Update dynamic labels that aren't covered by data-i18n
    const saveEl  = document.getElementById('btn-save-settings');
    const cancelEl= document.getElementById('btn-cancel-settings');
    if (saveEl)   saveEl.textContent   = t('settings.save');
    if (cancelEl) cancelEl.textContent = t('settings.cancel');
  }
}
