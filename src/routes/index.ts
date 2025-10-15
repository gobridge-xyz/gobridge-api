import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { BridgePointsService } from "../services/BridgePointsService";
import createPointsRouter from "./points";
import createBridgesRouter from "./bridges";
import createCalculateRouter from "./calculate";

export default function routesFactory(deps: { prisma: PrismaClient; points: BridgePointsService }) {
  const r = Router();
  r.use("/points", createPointsRouter(deps.points));
  r.use("/bridges", createBridgesRouter(deps.prisma));
  r.use("/calculateBridge", createCalculateRouter());
  return r;
}