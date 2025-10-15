// src/services/priceService.ts

export type PriceEntry = {
  usd: number;
  lastUpdatedAt: number; // epoch seconds
};

export type PriceMap = Record<string, PriceEntry>;

type Opts = {
  ids: string[];          // CoinGecko id'leri (örn: "ethereum", "reactive-network")
  vs?: string;            // varsayılan: "usd"
  intervalMs?: number;    // varsayılan: 30s
  proApiKey?: string;     // CoinGecko PRO kullanıyorsan .env'den geç
};

export class PriceService {
  private ids: string[];
  private vs: string;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  private prices: PriceMap = {};
  private fetching = false;
  private proApiKey?: string;

  constructor(opts: Opts) {
    this.ids = opts.ids.map((s) => s.toLowerCase());
    this.vs = opts.vs ?? "usd";
    this.intervalMs = opts.intervalMs ?? 30_000;
    this.proApiKey = opts.proApiKey || process.env.COINGECKO_API_KEY;
  }

  start() {
    // ilk fetch
    this.refresh().catch((e) => console.error("[PriceService] initial fetch error:", e));
    // periyodik
    this.timer = setInterval(() => {
      this.refresh().catch((e) => console.error("[PriceService] refresh error:", e));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Tek bir id için fiyat kaydı (yoksa undefined). */
  get(id: string): PriceEntry | undefined {
    return this.prices[id.toLowerCase()];
  }

  /** Tüm fiyatlar (kopya). */
  getAll(): PriceMap {
    return { ...this.prices };
  }

  /** Takip edilen id listesini runtime'da güncellemek istersen. */
  setIds(ids: string[]) {
    this.ids = ids.map((s) => s.toLowerCase());
  }

  private async refresh() {
    if (this.fetching || this.ids.length === 0) return;
    this.fetching = true;
    try {
      const url = new URL("https://api.coingecko.com/api/v3/simple/price");
      url.searchParams.set("ids", this.ids.join(","));
      url.searchParams.set("vs_currencies", this.vs);
      url.searchParams.set("include_last_updated_at", "true");

      const headers: Record<string, string> = { accept: "application/json" };
      if (this.proApiKey) headers["x-cg-pro-api-key"] = this.proApiKey;

      // Node 18+: AbortSignal.timeout mevcut. Yoksa basit timeout kontrolü ekleyebilirsin.
      const res = await fetch(url.toString(), {
        signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(8000) : undefined,
        headers,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CoinGecko HTTP ${res.status}: ${text || res.statusText}`);
      }

      const data = (await res.json()) as Record<
        string,
        { [vs: string]: number | undefined; last_updated_at?: number }
      >;

      const nowSec = Math.floor(Date.now() / 1000);
      for (const id of this.ids) {
        const row = data[id];
        const val = row?.[this.vs];
        if (typeof val === "number") {
          this.prices[id] = {
            usd: val,
            lastUpdatedAt: row.last_updated_at ?? nowSec,
          };
        }
      }
    } finally {
      this.fetching = false;
    }
  }
}