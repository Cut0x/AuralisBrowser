import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';
import { FORM_CAPTURE_SCRIPT, NEW_TAB_SCRIPT } from './browser-scripts.js';
import type { BrowserEngine } from './browser.js';
import { logError } from './logger.js';

export async function initBrowserEvents(e: BrowserEngine): Promise<void> {
  const parseNavPayload = (payload: unknown): { tabId: string; url: string } => {
    if (!payload) return { tabId: '', url: '' };
    if (typeof payload === 'string') return { tabId: e._activeTabId ?? '', url: payload };
    if (typeof payload === 'object') {
      const p = payload as { tabId?: unknown; url?: unknown };
      return {
        tabId: typeof p.tabId === 'string' ? p.tabId : '',
        url: typeof p.url === 'string' ? p.url : '',
      };
    }
    return { tabId: '', url: '' };
  };

  const applyNavigationState = (tabId: string, url: string): void => {
    if (!url || url === 'about:blank') return;
    if (tabId && !e._navPending && e._contentUrlByTab.get(tabId) === url) return;
    if (tabId) e._contentUrlByTab.set(tabId, url);
    if (!e._activeTabId || tabId !== e._activeTabId || e._showingNewtab) return;
    if (!e._navPending && url === e._lastUrl) return;

    e._navPending = false;
    e._lastUrl = url;
    e.clearLoadingGuard();
    setNavLoading(false);

    if (!e._overlayActive) void e.updateBounds(true);

    const activeTabId = e._activeTabId;
    const hist = activeTabId ? e.hist.getOrCreate(activeTabId) : null;
    const canBack = hist ? hist.navIdx > 0 : false;
    const canForward = hist ? hist.navIdx < hist.navHistory.length - 1 : false;
    setNavState(canBack, canForward);
    e.urlbar.value = url;
    e._onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });

    invoke<void>('content_eval', { tabId: activeTabId, js: NEW_TAB_SCRIPT }).catch(err => {
      logError('browser.events.injectNewTabScript', 'Injection NEW_TAB_SCRIPT echouee', { url, err: String(err) });
    });

    invoke<void>('content_eval', { tabId: activeTabId, js: FORM_CAPTURE_SCRIPT }).catch(err => {
      logError('browser.events.injectFormScript', 'Injection FORM_CAPTURE_SCRIPT echouee', { url, err: String(err) });
    });
  };

  await listen('content-navigated', ev => {
    try {
      const { tabId, url } = parseNavPayload(ev.payload);
      applyNavigationState(tabId, url);
    } catch (err) {
      logError('browser.events.contentNavigated', 'Erreur inattendue sur content-navigated', { err: String(err) });
    }
  });

  await listen('content-loaded', ev => {
    try {
      const { tabId, url } = parseNavPayload(ev.payload);
      applyNavigationState(tabId, url);
    } catch (err) {
      logError('browser.events.contentLoaded', 'Erreur inattendue sur content-loaded', { err: String(err) });
    }
  });

  await listen<{ tabId: string; url: string; title: string }>('content-title', ev => {
    try {
      const { tabId: sourceTabId, url, title } = ev.payload;
      if (!e._activeTabId || sourceTabId !== e._activeTabId) return;
      if (e._showingNewtab || url !== e.currentUrl()) return;
      const activeTabId = e._activeTabId;
      const hist = e.hist.getOrCreate(activeTabId);
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

  await listen<{ tabId: string; url: string }>('content-open-new-tab', ev => {
    try {
      const payload = ev.payload;
      if (!payload?.url || !e._onNewTab) return;
      if (payload.tabId && e._activeTabId && payload.tabId !== e._activeTabId) return;
      e._onNewTab(payload.url);
    } catch (err) {
      logError('browser.events.contentOpenNewTab', 'Erreur inattendue sur content-open-new-tab', { err: String(err) });
    }
  });

  await listen<{ tabId: string; data: string }>('content-pw-detected', ev => {
    try {
      if (ev.payload?.tabId && e._activeTabId && ev.payload.tabId !== e._activeTabId) return;
      const bytes = Uint8Array.from(atob(ev.payload.data), c => c.charCodeAt(0));
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
