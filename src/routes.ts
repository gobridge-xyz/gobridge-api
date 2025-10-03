import { Router } from "express";
import { CalcReqSchema, calculateBridge } from "./bridgeCalc";

const r = Router();

r.get("/health", (_req, res) => {
  res.json({ ok: true, service: "simple-ts-server", ts: new Date().toISOString() });
});

r.post("/calculateBridge", async (req, res) => {
  const parsed = CalcReqSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn("Invalid /calculateBridge request:", parsed.error.flatten());
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const out = await calculateBridge(parsed.data, req.app.locals.priceService);
    console.log("Calculated /calculateBridge for ip:", req.ip);
    res.json(out);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "calculateBridge failed" });
  }
});

export default r;
