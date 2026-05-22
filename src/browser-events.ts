import { listen }  from '@tauri-apps/api/event';
import { invoke }  from '@tauri-apps/api/core';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';
import { FORM_CAPTURE_SCRIPT, NEW_TAB_SCRIPT } from './browser-scripts.js';
import type { BrowserEngine } from './browser.js';

export async function initBrowserEvents(e: BrowserEngine): Promise<void> {
  await listen<{ tabId: string; url: string }>('content-navigated', ev => {
    const { tabId, url } = ev.payload;
    if (!url || url === 'about:blank' || tabId !== e._activeTabId) return;
    if (!e._navPending && url === e._lastUrl) return;
    e._navPending = false; e._lastUrl = url;
    setNavLoading(false);
    const hist = e.hist.getOrCreate(tabId);
    const canBack = hist.navIdx > 0, canForward = hist.navIdx < hist.navHistory.length - 1;
    setNavState(canBack, canForward);
    e.urlbar.value = url;
    e._onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });
    invoke<void>('tab_webview_eval', { tabId, js: NEW_TAB_SCRIPT }).catch(() => {});
    invoke<void>('tab_webview_eval', { tabId, js: FORM_CAPTURE_SCRIPT }).catch(() => {});
  });

  await listen<{ tabId: string; url: string; title: string }>('content-title', ev => {
    const { tabId, url, title } = ev.payload;
    if (tabId !== e._activeTabId) return;
    const hist = e.hist.getOrCreate(tabId);
    e._onNavigate({
      url, title, favicon: faviconFor(url),
      canBack: hist.navIdx > 0, canForward: hist.navIdx < hist.navHistory.length - 1,
    });
  });

  await listen<string>('content-open-new-tab', ev => {
    if (ev.payload && e._onNewTab) e._onNewTab(ev.payload);
  });

  await listen<string>('content-pw-detected', ev => {
    try {
      const bytes = Uint8Array.from(atob(ev.payload), c => c.charCodeAt(0));
      const { u, p } = JSON.parse(new TextDecoder().decode(bytes)) as { u: string; p: string };
      if (p && e._onPwDetected) e._onPwDetected(u || '', p);
    } catch { /* payload malformé */ }
  });

  await e.updateBounds(false);
}
