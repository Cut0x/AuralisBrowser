// Tab data model — pure state, no DOM.

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

  getActive():          Tab | null { return this.tabs.find(t => t.id === this.activeId) ?? null; }
  getById(id: string):  Tab | null { return this.tabs.find(t => t.id === id) ?? null; }
  getAll():             Tab[]      { return [...this.tabs]; }
  getActiveId():        string | null { return this.activeId; }

  private emit(): void { this.onChange([...this.tabs], this.activeId); }
}
