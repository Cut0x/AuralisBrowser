/**
 * state.ts — État global partagé entre tous les modules UI.
 * Utilise des liaisons vivantes ES modules : les importeurs voient toujours
 * la valeur courante sans avoir besoin de re-importer.
 */

import type { BrowserEngine }   from './browser.js';
import type { TabManager }      from './tabs.js';
import type { BrowserSettings } from './storage.js';

// Instances uniques initialisées au démarrage dans main.ts
export let browser!:  BrowserEngine;
export let tabs!:     TabManager;
export let settings!: BrowserSettings;

/** Initialise les trois références partagées (appelé une seule fois). */
export function initState(
  b: BrowserEngine,
  t: TabManager,
  s: BrowserSettings,
): void {
  browser  = b;
  tabs     = t;
  settings = s;
}

/**
 * Met à jour settings et retourne la nouvelle valeur.
 * Utiliser comme : settings = updateSettings({ ...settings, theme: 'dark' })
 */
export function updateSettings(s: BrowserSettings): BrowserSettings {
  settings = s;
  return s;
}
