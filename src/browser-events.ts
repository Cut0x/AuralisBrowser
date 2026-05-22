import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';
import { FORM_CAPTURE_SCRIPT, NEW_TAB_SCRIPT } from './browser-scripts.js';
import type { BrowserEngine } from './browser.js';
import { logError } from './logger.js';

export async function initBrowserEvents(e: BrowserEngine): Promise<void> {
  const applyNavigationState = (url: string): void => {
    if (!url || url === 'about:blank' || e._showingNewtab) return;
    if (!e._navPending && url === e._lastUrl) return;

    e._navPending = false;
    e._lastUrl = url;
    e._contentUrl = url;
    e.clearLoadingGuard();
    setNavLoading(false);

    if (!e._overlayActive) void e.updateBounds(true);

    const tabId = e._activeTabId;
    const hist = tabId ? e.hist.getOrCreate(tabId) : null;
    const canBack = hist ? hist.navIdx > 0 : false;
    const canForward = hist ? hist.navIdx < hist.navHistory.length - 1 : false;
    setNavState(canBack, canForward);
    e.urlbar.value = url;
    e._onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });

    invoke<void>('content_eval', { js: NEW_TAB_SCRIPT }).catch(err => {
      logError('browser.events.injectNewTabScript', 'Injection NEW_TAB_SCRIPT echouee', { url, err: String(err) });
    });

    invoke<void>('content_eval', { js: FORM_CAPTURE_SCRIPT }).catch(err => {
      logError('browser.events.injectFormScript', 'Injection FORM_CAPTURE_SCRIPT echouee', { url, err: String(err) });
    });
  };

  await listen<string>('content-navigated', ev => {
    try {
      applyNavigationState(ev.payload);
    } catch (err) {
      logError('browser.events.contentNavigated', 'Erreur inattendue sur content-navigated', { err: String(err) });
    }
  });

  await listen<string>('content-loaded', ev => {
    try {
      applyNavigationState(ev.payload);
    } catch (err) {
      logError('browser.events.contentLoaded', 'Erreur inattendue sur content-loaded', { err: String(err) });
    }
  });

  await listen<{ url: string; title: string }>('content-title', ev => {
    try {
      const { url, title } = ev.payload;
      if (e._showingNewtab || url !== e.currentUrl()) return;
      const tabId = e._activeTabId;
      const hist = tabId ? e.hist.getOrCreate(tabId) : null;
      e._onNavigate({
        url,
        title,
        favicon: faviconFor(url),
        canBack: hist ? hist.navIdx > 0 : false,
        canForward: hist ? hist.navIdx < hist.navHistory.length - 1 : false,
      });
    } catch (err) {
      logError('browser.events.contentTitle', 'Erreur inattendue sur content-title', { err: String(err) });
    }
  });

  await listen<string>('content-open-new-tab', ev => {
    try {
      if (ev.payload && e._onNewTab) e._onNewTab(ev.payload);
    } catch (err) {
      logError('browser.events.contentOpenNewTab', 'Erreur inattendue sur content-open-new-tab', { err: String(err) });
    }
  });

  await listen<string>('content-pw-detected', ev => {
    try {
      const bytes = Uint8Array.from(atob(ev.payload), c => c.charCodeAt(0));
      const { u, p } = JSON.parse(new TextDecoder().decode(bytes)) as { u: string; p: string };
      if (p && e._onPwDetected) e._onPwDetected(u || '', p);
    } catch (err) {
      logError('browser.events.contentPwDetected', 'Payload malforme ou invalide', { err: String(err) });
    }
  });

  await e.updateBounds(false).catch(err => {
    logError('browser.events.init.updateBounds', 'Initialisation des bounds impossible', { err: String(err) });
  });
}
