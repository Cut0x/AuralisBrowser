import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';
import { FORM_CAPTURE_SCRIPT, NEW_TAB_SCRIPT } from './browser-scripts.js';
import type { BrowserEngine } from './browser.js';
import { logError } from './logger.js';

export async function initBrowserEvents(e: BrowserEngine): Promise<void> {
  await listen<{ tabId: string; url: string }>('content-navigated', ev => {
    try {
      const { tabId, url } = ev.payload;
      if (!url || url === 'about:blank' || tabId !== e._activeTabId) return;
      if (!e._navPending && url === e._lastUrl) return;
      e._navPending = false;
      e._lastUrl = url;
      setNavLoading(false);
      if (!e._overlayActive) void e.updateBounds(true);
      const hist = e.hist.getOrCreate(tabId);
      const canBack = hist.navIdx > 0;
      const canForward = hist.navIdx < hist.navHistory.length - 1;
      setNavState(canBack, canForward);
      e.urlbar.value = url;
      e._onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });

      invoke<void>('tab_webview_eval', { tabId, js: NEW_TAB_SCRIPT }).catch(err => {
        logError('browser.events.contentNavigated.injectNewTabScript', 'Injection NEW_TAB_SCRIPT échouée', { tabId, url, err: String(err) });
      });
      invoke<void>('tab_webview_eval', { tabId, js: FORM_CAPTURE_SCRIPT }).catch(err => {
        logError('browser.events.contentNavigated.injectFormScript', 'Injection FORM_CAPTURE_SCRIPT échouée', { tabId, url, err: String(err) });
      });
    } catch (err) {
      logError('browser.events.contentNavigated', 'Erreur inattendue sur content-navigated', { err: String(err) });
    }
  });

  await listen<{ tabId: string; url: string; title: string }>('content-title', ev => {
    try {
      const { tabId, url, title } = ev.payload;
      if (tabId !== e._activeTabId) return;
      const hist = e.hist.getOrCreate(tabId);
      e._onNavigate({
        url,
        title,
        favicon: faviconFor(url),
        canBack: hist.navIdx > 0,
        canForward: hist.navIdx < hist.navHistory.length - 1,
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
      logError('browser.events.contentPwDetected', 'Payload malformé ou invalide', { err: String(err) });
    }
  });

  await e.updateBounds(false).catch(err => {
    logError('browser.events.init.updateBounds', 'Initialisation des bounds impossible', { err: String(err) });
  });
}

