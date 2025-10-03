// src/priceService.ts
type PriceEntry = {
  usd: number;
  lastUpdatedAt: number; // epoch seconds from coingecko
};

type PriceMap = Record<string, PriceEntry>;

export class PriceService {
  private ids: string[];
  private vs: string;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  private prices: PriceMap = {};
  private fetching = false;

  constructor(opts: { ids: string[]; vs?: string; intervalMs?: number }) {
    this.ids = opts.ids;
    this.vs = opts.vs ?? "usd";
    this.intervalMs = opts.intervalMs ?? 10_000; // 10s
  }

  start() {
    this.refresh().catch((e) => console.error("[PriceService] initial fetch error:", e));
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

  private async refresh() {
    if (this.fetching) return;
    this.fetching = true;
    try {
      const url = new URL("https://api.coingecko.com/api/v3/simple/price");
      url.searchParams.set("ids", this.ids.join(","));
      url.searchParams.set("vs_currencies", this.vs);
      url.searchParams.set("include_last_updated_at", "true");

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000),
        headers: {
          "accept": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`CoinGecko HTTP ${res.status}: ${text || res.statusText}`);
      }

      const data = (await res.json()) as Record<
        string,
        { usd?: number; last_updated_at?: number }
      >;

      const nowSec = Math.floor(Date.now() / 1000);
      for (const id of this.ids) {
        const row = data[id];
        if (row?.usd != null) {
          this.prices[id] = {
            usd: row.usd,
            lastUpdatedAt: row.last_updated_at ?? nowSec,
          };
        }
      }
    } finally {
      this.fetching = false;
    }
  }
}