import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { BridgePointsService } from "../services/BridgePointsService.js";
import createPointsRouter from "./points.js";
import createBridgesRouter from "./bridges.js";
import createCalculateRouter from "./calculate.js";

export default function routesFactory(deps: { prisma: PrismaClient; points: BridgePointsService }) {
  const r = Router();
  r.use("/points", createPointsRouter(deps.points));
  r.use("/bridges", createBridgesRouter(deps.prisma));
  r.use("/calculateBridge", createCalculateRouter());
  return r;
}