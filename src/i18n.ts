import { STRINGS } from './i18n-strings.js';
export type { Lang } from './i18n-strings.js';
import type { Lang } from './i18n-strings.js';

let _lang: Lang = 'fr';

export function setLang(lang: Lang): void {
  _lang = lang;
  applyAll();
}

export function getLang(): Lang { return _lang; }

export function t(key: string): string {
  return STRINGS[_lang][key] ?? STRINGS['en'][key] ?? key;
}

export function applyAll(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle!);
  });
}
