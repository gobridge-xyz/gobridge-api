import type { Address, Hash, Hex, Abi, Log } from "viem";
import {
  createPublicClient,
  webSocket,
  http,
  fallback,
  type PublicClient,
} from "viem";
import { PrismaClient } from "@prisma/client";

import { ChainKey, CFG } from "../config/index.js";
import { goBridgeManagerAbi } from "../lib/abi.js";
import {
  backfill,
  getCursor,
  saveCursor,
  findEventSignature,
  type Cursor,
} from "../lib/backfill.js";

/** ---- Types ---- */

export type AwardRule = {
  basePoints: number;
  perChainBonus?: Partial<Record<ChainKey, number>>;
};

type BridgeInitEvent = {
  user: string;
  fromChain: number;
  fromHash: string;
  requestId: string;
  startTs: Date;
};

type BridgeFinalizeEvent = {
  requestId: string;
  toChain: number;
  toHash: string;
  endTs: Date;
};

type StartWatcherParams = {
  client: PublicClient;                 // pollClient (HTTP-only) önerilir
  address: Address;
  abi: Abi;
  eventName: string;
  fromBlock: bigint;                    // cursor.block
  pollingInterval?: number;             // ms
  strict?: boolean;
  onLogBatch: (logs: Log[]) => Promise<void>;
  onRestart?: (err: unknown, attempt: number) => void; // opsiyonel loglama
  backoffBaseMs?: number;               // 1000 gibi
  backoffMaxMs?: number;                // 15000 gibi
};

export class BridgePointsService {
  private prisma: PrismaClient;
  private chainKeys: ChainKey[];
  private award: AwardRule;
  private unwatchers: Array<() => void> = [];
  private intervals: NodeJS.Timeout[] = [];        // ★ periyodik backfill için
  private tailRunning = new Map<string, boolean>();

  private pendingFinalized = new Map<
    string,
    { toChain: number; toHash: string; endTs: Date }
  >();

  private static readonly CONFIRMATIONS = 2;       // ★ reorg güvenliği

  constructor(opts: { prisma: PrismaClient; chainKeys: ChainKey[]; award?: AwardRule }) {
    this.prisma = opts.prisma;
    this.chainKeys = opts.chainKeys;
    this.award = opts.award ?? {
      basePoints: Number(process.env.POINTS_PER_BRIDGE ?? 35),
      perChainBonus: {
        mainnet: Number(process.env.BONUS_ETH ?? 0),
        arb: Number(process.env.BONUS_ARB ?? 0),
        base: Number(process.env.BONUS_BASE ?? 0),
      },
    };
  }

  /** Başlat: tüm zincirlerde init/finalize event’lerini dinler */
  async start() {
    for (const chainKey of this.chainKeys) {
      const chainCfg = CFG.chains[chainKey];

      // ★ WS + HTTP fallback

      const client = createPublicClient({ chain: chainCfg.chain, transport: http() }) as any;

      // ★ Cursor’ları yükle (yoksa chain deploy block’u ya da 0n verebilirsin)
      const defaultFromBlock = BigInt(chainCfg.deploymentBlock ?? 0);
      const initCursor = await getCursor(this.prisma, chainKey, "BridgeInitialized", defaultFromBlock);
      const finCursor  = await getCursor(this.prisma, chainKey, "BridgeFinalized", defaultFromBlock);

      // ★ Periyodik backfill (30 sn’de bir, latest-Confirmations’a kadar)
      const doBackfill = async () => {
        try {
          await backfill(
            {
              client: client as any,
              prisma: this.prisma,
              chainKey,
              address: chainCfg.bridge as Address,
              abi: goBridgeManagerAbi as unknown as Abi,
              eventName: "BridgeInitialized",
              confirmations: BridgePointsService.CONFIRMATIONS,
              cursor: initCursor,
            },
            async (log) => this.handleInitLog(client, log as any, chainKey)
          );

          await backfill(
            {
              client: client as any,
              prisma: this.prisma,
              chainKey,
              address: chainCfg.bridge as Address,
              abi: goBridgeManagerAbi as unknown as Abi,
              eventName: "BridgeFinalized",
              confirmations: BridgePointsService.CONFIRMATIONS,
              cursor: finCursor,
            },
            async (log) => this.handleFinLog(client, log as any, chainKey)
          );
        } catch (e) {
          console.error(`[BridgePointsService] backfill ${chainKey} error`, e);
        }
      };

      await doBackfill();
      const iv = setInterval(doBackfill, 30_000);
      this.intervals.push(iv);

      this.startTailer(client, chainKey, chainCfg.bridge as Address, goBridgeManagerAbi as Abi, "BridgeInitialized", initCursor, (log) => this.handleInitLog(client, log, chainKey), 5000, BridgePointsService.CONFIRMATIONS);
      this.startTailer(client, chainKey, chainCfg.bridge as Address, goBridgeManagerAbi as Abi, "BridgeFinalized",   finCursor,  (log) => this.handleFinLog(client, log, chainKey),  5000, BridgePointsService.CONFIRMATIONS);

      console.log(`[BridgePointsService] watching ${chainKey} @ ${chainCfg.bridge}`);
    }
  }

  /** Tüm watcher ve interval’ları kapatır */
  async stop() {
    this.stopTailers();
    for (const t of this.intervals) {
      try { clearInterval(t); } catch {}
    }
    this.intervals = [];
  }

  /** --- WS & Backfill ortak log handler’ları --- */

  private async handleInitLog(client: PublicClient, log: Log, chainKey: ChainKey) {
    try {
      const args: any = (log as any).args ?? {};
      const user = (args?.srcInitiator as Address)?.toLowerCase();
      const requestId = String(args?.requestId as Hash | Hex);
      const fromHash = (log as any).transactionHash as Hash;

      const blk = await this.safeGetBlock(client, log.blockNumber, (log as any).blockHash as Hash | undefined, fromHash);
      const ts = typeof blk.timestamp === "bigint" ? Number(blk.timestamp) : (blk.timestamp as number);
      const startTs = new Date(ts * 1000);

      await this.onInitialized(
        {
          user,
          fromChain: CFG.chains[chainKey].chain.id,
          fromHash,
          requestId,
          startTs,
        },
        chainKey
      );
    } catch (e) {
      console.error(`[BridgePointsService] handleInitLog save fail ${chainKey}`, e);
    }
  }

  private async handleFinLog(client: PublicClient, log: Log, chainKey: ChainKey) {
    try {
      const args: any = (log as any).args ?? {};
      const requestId = String(args?.requestId as Hash | Hex);
      const toChain = Number(CFG.chains[chainKey].chain.id);
      const toHash = (log as any).transactionHash as Hash;

      const blk = await this.safeGetBlock(client, log.blockNumber, (log as any).blockHash as Hash | undefined, toHash);
      const ts = typeof blk.timestamp === "bigint" ? Number(blk.timestamp) : (blk.timestamp as number);
      const endTs = new Date(ts * 1000);

      await this.onFinalized({
        requestId,
        toChain,
        toHash: String(toHash),
        endTs,
      });
    } catch (e) {
      console.error(`[BridgePointsService] handleFinLog save fail ${chainKey}`, e);
    }
  }

  /** --- helpers --- */
  private startTailer(
    client: PublicClient,
    chainKey: ChainKey,
    address: Address,
    abi: Abi,
    eventName: "BridgeInitialized" | "BridgeFinalized",
    cursor: Cursor,
    handle: (log: Log) => Promise<void>,
    intervalMs = 5000,
    confirmations = 2
  ) {
    const key = `${chainKey}:${eventName}`;
    if (this.tailRunning.get(key)) return;
    this.tailRunning.set(key, true);

    const tick = async () => {
      if (!this.tailRunning.get(key)) return;
      try {
        await backfill(
          {
            client: client as any,
            prisma: this.prisma,
            chainKey,
            address,
            abi,
            eventName,
            confirmations,
            cursor,
          },
          async (log) => handle(log as any)
        );
      } catch (e) {
        console.error(`[Tailer] ${key} error:`, e);
      } finally {
        setTimeout(tick, intervalMs);
      }
    };

    tick();
  }

  private stopTailers() {
    for (const k of this.tailRunning.keys()) this.tailRunning.set(k, false);
  }

  private calcAward(chain: ChainKey) {
    const base = this.award.basePoints;
    const bonus = this.award.perChainBonus?.[chain] ?? 0;
    return base + bonus;
  }

  private async safeGetBlock(
    client: PublicClient,
    blockNumber?: bigint,
    blockHash?: Hash,
    txHash?: Hash
  ) {
    if (blockNumber != null) {
      return client.getBlock({ blockNumber });
    }
    if (blockHash) {
      return client.getBlock({ blockHash });
    }
    if (txHash) {
      const rcpt = await client.getTransactionReceipt({ hash: txHash });
      if (rcpt.blockNumber != null) {
        return client.getBlock({ blockNumber: rcpt.blockNumber });
      }
      if (rcpt.blockHash) {
        return client.getBlock({ blockHash: rcpt.blockHash as Hash });
      }
    }
    return client.getBlock({ blockTag: "latest" });
  }

  private async onInitialized(evt: BridgeInitEvent, chainKey: ChainKey) {
    console.log(`[BridgePointsService] onInitialized ${chainKey} ${evt.requestId}`);

    const exist = await this.prisma.bridge.findFirst({
      where: {
        OR: [{ fromHash: evt.fromHash }, { requestId: evt.requestId }],
      },
      select: { id: true },
    });

    if (exist) return;

    const award = this.calcAward(chainKey);

    await this.prisma.$transaction(async (trx) => {
      // kullanıcı puanı
      await trx.userPoints.upsert({
        where: { walletAddress: evt.user },
        create: { walletAddress: evt.user, points: award },
        update: { points: { increment: award } },
      });

      // köprü kaydı (partial)
      await trx.bridge.create({
        data: {
          walletAddress: evt.user,
          requestId: evt.requestId,
          fromChain: evt.fromChain,
          fromHash: evt.fromHash,
          startTimestamp: evt.startTs,
          pointsAwarded: award,
        },
      });

      const fin = this.pendingFinalized.get(evt.requestId);
      if (fin) {
        const durationMs = Math.max(0, fin.endTs.getTime() - evt.startTs.getTime());
        await trx.bridge.update({
          where: { requestId: evt.requestId },
          data: {
            toChain: fin.toChain,
            toHash: fin.toHash,
            endTimestamp: fin.endTs,
            durationMs,
          },
        });
        this.pendingFinalized.delete(evt.requestId);
      }
    });
  }

  private async onFinalized(evt: BridgeFinalizeEvent) {
    console.log(`[BridgePointsService] onFinalized ${evt.requestId}`);

    const b = await this.prisma.bridge.findUnique({
      where: { requestId: evt.requestId },
    });

    if (!b) {
      this.pendingFinalized.set(evt.requestId, {
        toChain: evt.toChain,
        toHash: evt.toHash,
        endTs: evt.endTs,
      });
      return;
    }

    const durationMs =
      b?.startTimestamp
        ? Math.max(0, evt.endTs.getTime() - b.startTimestamp.getTime())
        : null;

    await this.prisma.bridge.update({
      where: { requestId: evt.requestId },
      data: {
        toChain: evt.toChain,
        toHash: evt.toHash,
        endTimestamp: evt.endTs,
        durationMs: durationMs ?? undefined,
      },
    });
  }

  /** UI için tek obje + bridges[] */
  async getUserView(address: string, limit = 100) {
    const a = address.toLowerCase();

    const user = await this.prisma.userPoints.findUnique({
      where: { walletAddress: a },
    });

    const points = user?.points ?? 0;

    const bridges = await this.prisma.bridge.findMany({
      where: { walletAddress: a },
      orderBy: { startTimestamp: "desc" },
      take: limit,
      select: {
        fromChain: true,
        fromHash: true,
        toChain: true,
        toHash: true,
        startTimestamp: true,
        endTimestamp: true,
        durationMs: true,
        pointsAwarded: true,
      },
    });

    const { computeLevel } = await import("../lib/levels.js");
    const { level, curCap, nextCap, progressPct } = computeLevel(points);

    console.log(`[BridgePointsService] getUserView ${a} points=${points} level=${level}`);

    return {
      address: a,
      points,
      level,
      thresholds: { current: curCap, next: nextCap },
      progressPct,
      bridges,
      updatedAt: user?.updatedAt ?? null,
      createdAt: user?.createdAt ?? null,
    };
  }
}