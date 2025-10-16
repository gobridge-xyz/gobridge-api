// src/services/priceService.ts

export type PriceEntry = {
  usd: number;
  lastUpdatedAt: number; // epoch seconds
};

export type PriceMap = Record<string, PriceEntry>;

type Opts = {
  symbols: string[];      // Token symbols
  intervalMs?: number;    // default 30s
};

export class PriceService {
  private symbols: string[];
  private vs: string;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  private prices: PriceMap = {};
  private fetching = false;
  private apiKey: string;

  constructor(opts: Opts) {
    this.symbols = opts.symbols.map((s) => s.toUpperCase());
    this.intervalMs = opts.intervalMs ?? 30_000;
    this.apiKey = process.env.ALCHEMY_API_KEY;
  }

  async start() {
    await this.refresh().catch((e) => console.error("[PriceService] initial fetch error:", e));

    this.timer = setInterval(() => {
      this.refresh().catch((e) => console.error("[PriceService] refresh error:", e));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  get(id: string): PriceEntry | undefined {
    return this.prices[id.toLowerCase()];
  }

  getAll(): PriceMap {
    return { ...this.prices };
  }

  setSymbols(symbols: string[]) {
    this.symbols = symbols.map((s) => s.toUpperCase());
  }

  private async refresh() {
    if (this.fetching || this.symbols.length === 0) return;
    this.fetching = true;
    try {
      const url = new URL(`https://api.g.alchemy.com/prices/v1/${this.apiKey}/tokens/by-symbol`);
      for (const s of this.symbols) url.searchParams.append("symbols", s.toUpperCase());

      const res = await fetch(url, {
        method: "GET",
        signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(8000) : undefined,
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Alchemy HTTP ${res.status}: ${text || res.statusText}`);
      }

      type PriceRow = { currency: string; value: string; lastUpdatedAt: string };
      type DataRow = { symbol: string; prices: PriceRow[]; error?: string };
      const body = (await res.json()) as { data?: DataRow[] };

      const list = body.data ?? [];
      const bySymbol = new Map<string, DataRow>();
      for (const row of list) {
        if (!row?.symbol) continue;
        bySymbol.set(row.symbol.toUpperCase(), row);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      for (const wantSym of this.symbols) {
        const row = bySymbol.get(wantSym.toUpperCase());
        if (!row) {
          console.warn(`[PriceService] missing symbol in response: ${wantSym}`);
          continue;
        }

        const usdRec = row.prices?.find(p => p.currency?.toUpperCase() === "USD");
        if (!usdRec?.value) continue;

        const ts = Date.parse(usdRec.lastUpdatedAt);
        this.prices[wantSym] = {
          usd: Number(usdRec.value),
          lastUpdatedAt: Number.isFinite(ts) ? Math.floor(ts / 1000) : nowSec,
        };
      }
    } finally {
      this.fetching = false;
    }
  }
}