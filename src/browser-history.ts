export interface TabHistory { navHistory: string[]; navIdx: number; }

export class HistManager {
  private map = new Map<string, TabHistory>();

  getOrCreate(id: string): TabHistory {
    if (!this.map.has(id)) this.map.set(id, { navHistory: [], navIdx: -1 });
    return this.map.get(id)!;
  }

  get(id: string): TabHistory | undefined { return this.map.get(id); }

  delete(id: string): void { this.map.delete(id); }

  back(id: string): string | null {
    const h = this.getOrCreate(id);
    if (h.navIdx <= 0) return null;
    h.navIdx--;
    return h.navHistory[h.navIdx];
  }

  forward(id: string): string | null {
    const h = this.getOrCreate(id);
    if (h.navIdx >= h.navHistory.length - 1) return null;
    h.navIdx++;
    return h.navHistory[h.navIdx];
  }

  canBack(id: string): boolean { return (this.get(id)?.navIdx ?? 0) > 0; }

  canForward(id: string): boolean {
    const h = this.get(id);
    return h ? h.navIdx < h.navHistory.length - 1 : false;
  }
}
