/**
 * tabs.ts - Modèle de données des onglets (état pur, sans manipulation du DOM).
 * TabManager gère la liste d'onglets, l'onglet actif et notifie les observateurs
 * via un callback onChange à chaque modification.
 */

export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

type ChangeHandler = (tabs: Tab[], activeId: string | null) => void;

export class TabManager {
  private tabs:     Tab[] = [];
  private activeId: string | null = null;
  private onChange: ChangeHandler;

  constructor(onChange: ChangeHandler) { this.onChange = onChange; }

  createTab(url = 'about:newtab', activate = true): Tab {
    const tab: Tab = {
      id: crypto.randomUUID(), title: url === 'about:newtab' ? 'Nouvel onglet' : url,
      url, favicon: '', isLoading: false, canGoBack: false, canGoForward: false,
    };
    this.tabs.push(tab);
    if (activate) { this.activeId = tab.id; }
    this.emit();
    return tab;
  }

  closeTab(id: string): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) { this.createTab('about:newtab', true); return; }

    if (this.activeId === id) {
      this.activeId = this.tabs[Math.min(idx, this.tabs.length - 1)].id;
    }
    this.emit();
  }

  setActive(id: string): void {
    if (!this.tabs.find(t => t.id === id)) return;
    this.activeId = id;
    this.emit();
  }

  updateTab(id: string, patch: Partial<Omit<Tab, 'id'>>): void {
    const t = this.tabs.find(t => t.id === id);
    if (!t) return;
    Object.assign(t, patch);
    this.emit();
  }

  /** Déplace draggedId avant targetId dans la liste des onglets. */
  reorderTabs(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return;
    const from = this.tabs.findIndex(t => t.id === draggedId);
    const to   = this.tabs.findIndex(t => t.id === targetId);
    if (from === -1 || to === -1) return;
    const [tab] = this.tabs.splice(from, 1);
    this.tabs.splice(to, 0, tab);
    this.emit();
  }

  getActive():          Tab | null { return this.tabs.find(t => t.id === this.activeId) ?? null; }
  getById(id: string):  Tab | null { return this.tabs.find(t => t.id === id) ?? null; }
  getAll():             Tab[]      { return [...this.tabs]; }
  getActiveId():        string | null { return this.activeId; }

  private emit(): void { this.onChange([...this.tabs], this.activeId); }
}
