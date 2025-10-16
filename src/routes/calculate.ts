import { Router, Request, Response } from "express";
import type { PriceService } from "../services/priceService.js";
import {
  CalcReqSchema,
  type CalcReq,
  calculateBridge,
} from "../services/calculateBridge.js";

function normalizeQueryToCalcReq(q: any): Record<string, unknown> {
  const srcChainId  = q.srcChainId  ?? q.fromChain  ?? q.fromChainId  ?? q.srcChain;
  const destChainId = q.destChainId ?? q.toChain    ?? q.toChainId    ?? q.destChain;

  const srcToken    = q.srcToken    ?? q.fromToken;
  const destToken   = q.destToken   ?? q.toToken;

  const srcInitiator = q.srcInitiator ?? q.initiator ?? q.sender ?? q.account;
  const destTo       = q.destTo       ?? q.receiver  ?? q.recipient;

  const amountInRaw  = q.amountInRaw  ?? q.amountIn ?? q.amount;

  return {
    srcInitiator,
    destTo,
    srcChainId,
    destChainId,
    srcToken,
    destToken,
    amountInRaw,
  };
}

export default function createCalculateRouter() {
  const r = Router();

  const handle = async (payload: unknown, req: Request, res: Response) => {
    const data =
      req.method === "GET" ? normalizeQueryToCalcReq(payload) : (payload as any);

    const parsed = CalcReqSchema.safeParse(data);
    if (!parsed.success) {
      console.warn("Invalid /calculateBridge request:", parsed.error.flatten());
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const priceService: PriceService | undefined = req.app.locals.priceService;
      const out = await calculateBridge(parsed.data as CalcReq, priceService!);

      res.json(out);
    } catch (err: any) {
      console.error("[/calculateBridge] error:", err);
      res.status(500).json({ error: err?.message ?? "calculateBridge failed" });
    }
  };

  r.post("/", async (req, res) => handle(req.body, req, res));
  r.get("/", async (req, res) => handle(req.query, req, res));

  return r;
}