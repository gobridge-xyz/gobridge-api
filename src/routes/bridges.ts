import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

export default function createBridgesRouter(prisma: PrismaClient) {
  const r = Router();

  r.get("/", async (req, res, next) => {
    try {
      const schema = z.object({
        addr: z.string().min(1),
        fromChain: z.coerce.number().int().optional(),
        toChain: z.coerce.number().int().optional(),
        sort: z.enum(["start", "end"]).default("start"),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      });

      const { addr, fromChain, toChain, sort, limit, cursor } = schema.parse(req.query);

      const where: any = { walletAddress: addr.toLowerCase() };
      if (fromChain != null) where.fromChain = fromChain;
      if (toChain != null) where.toChain = toChain;

      const orderBy =
        sort === "end"
          ? { endTimestamp: "desc" as const }
          : { startTimestamp: "desc" as const };

      const rows = await prisma.bridge.findMany({
        where,
        orderBy,
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
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

      res.json({
        items: rows,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}