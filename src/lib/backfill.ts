import type { Abi, Address, PublicClient, Log } from "viem";
import { parseAbiItem } from "viem";
import type { PrismaClient } from "@prisma/client";

export type Cursor = { block: bigint; logIndex: number };

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export function findEventSignature(abi: Abi, eventName: string): string {
  const ev = (abi as any[]).find((i) => i?.type === "event" && i?.name === eventName);
  if (!ev) throw new Error(`Event not found in ABI: ${eventName}`);

  const params = (ev.inputs ?? [])
    .map((inp: any, idx: number) => {
      const nm = inp?.name && inp.name.length > 0 ? inp.name : `arg${idx}`;
      const ix = inp?.indexed ? "indexed " : "";
      return `${inp.type} ${ix}${nm}`;
    })
    .join(", ");

  return `event ${ev.name}(${params})${ev.anonymous ? " anonymous" : ""}`;
}

export async function getCursor(
  prisma: PrismaClient,
  chainKey: string,
  eventName: string,
  defaultBlock: bigint
): Promise<Cursor> {
  const c = await prisma.cursor.findUnique({ where: { chainKey_eventName: { chainKey, eventName } } });
  if (!c) return { block: defaultBlock, logIndex: 0 };
  return { block: BigInt(c.block.toString()), logIndex: c.logIndex };
}

export async function saveCursor(
  prisma: PrismaClient,
  chainKey: string,
  eventName: string,
  cursor: Cursor
): Promise<void> {
  await prisma.cursor.upsert({
    where: { chainKey_eventName: { chainKey, eventName } },
    create: {
      chainKey,
      eventName,
      block: cursor.block, // Prisma BigInt
      logIndex: cursor.logIndex,
    },
    update: {
      block: cursor.block,
      logIndex: cursor.logIndex,
    },
  });
}

const backfillRunning = new Map<string, boolean>();
const DEFAULT_MAX_RANGE = 15_000n;
const BACKOFF_MS = 400;

export async function backfill<TLog extends Log<any, any, any>>(
  {
    client,
    prisma,
    chainKey,
    address,
    abi,
    eventName,
    confirmations,
    cursor,
  }: {
    client: PublicClient;
    prisma: PrismaClient;
    chainKey: string;
    address: Address;
    abi: Abi;
    eventName: string;
    confirmations: number;
    cursor: Cursor;
  },
  handleLog: (log: TLog) => Promise<void>
): Promise<void> {
  const key = `${chainKey}:${eventName}`;
  if (backfillRunning.get(key)) return;

  backfillRunning.set(key, true);
  try {
    const latest = await client.getBlockNumber();
    const confirmedBlock = latest - BigInt(confirmations);
    if (confirmedBlock < cursor.block) return;

    const sig = findEventSignature(abi, eventName);
    const evItem = parseAbiItem(sig);

    let maxRange = DEFAULT_MAX_RANGE;

    while (cursor.block < confirmedBlock) {
      let range = maxRange;
      if (cursor.block + range > confirmedBlock) range = confirmedBlock - cursor.block;

      if (range < 0n) range = 0n;
      if (range === 0n) range = 1n;
      const to = cursor.block + range;
      try {
        const logs = await client.getLogs({
          address,
          event: evItem as any,
          fromBlock: cursor.block,
          toBlock: to,
        });

        logs.sort((a: any, b: any) =>
          a.blockNumber === b.blockNumber
            ? Number(a.logIndex - b.logIndex)
            : Number(a.blockNumber - b.blockNumber)
        );

        for (const log of logs as unknown as TLog[]) {
          await handleLog(log);
          cursor.block = log.blockNumber;
          cursor.logIndex = Number(log.logIndex);
          await saveCursor(prisma, chainKey, eventName, cursor);
        }

        cursor.block = to + 1n;
      } catch (err) {
        const msg = `${err?.message || err}`.toLowerCase();
        const shrinkTriggers = [
          "exceed maximum block range",
          "block range",
          "more than",
          "too many results",
          "limit",
        ];

        if (shrinkTriggers.some(s => msg.includes(s))) {
          maxRange = maxRange > 1000n ? maxRange / 2n : 1000n;
          await sleep(BACKOFF_MS);
          continue;
        }

        if (msg.includes("rate") || msg.includes("429") || msg.includes("temporarily unavailable")) {
          await sleep(800);
          continue;
        }

        console.warn(`[Backfill:${chainKey}] non-fatal error:`, err);
        await sleep(800);
        continue;  
      }
    }
  } finally {
    backfillRunning.set(key, false);
  }
}