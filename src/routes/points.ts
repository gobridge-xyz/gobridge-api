import { Router } from "express";
import { z } from "zod";
import { BridgePointsService } from "../services/BridgePointsService.js";

export default function createPointsRouter(points: BridgePointsService) {
  const r = Router();
  r.get("/", async (req, res, next) => {
    try {
      const schema = z.object({ addr: z.string().min(1), limit: z.coerce.number().int().min(1).max(500).optional() });
      const { addr, limit } = schema.parse(req.query);
      const view = await points.getUserView(addr, limit ?? 100);
      res.json(view);
    } catch (e) { next(e); }
  });
  return r;
}