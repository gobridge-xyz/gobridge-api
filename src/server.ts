import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { z } from "zod";

import routesFactory from "./routes/index.js";
import { PriceService } from "./services/priceService.js";

import { PrismaClient } from "@prisma/client";
import { BridgePointsService } from "./services/BridgePointsService.js";
import { ChainKey } from "./config/index.js";

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

const allowlist = ["http://localhost:3000", process.env.FRONTEND_URL].filter(Boolean) as string[];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: "200kb" }));

const limiter = rateLimit({
  windowMs: 15_000, max: 50, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || req.path === "/health",
});
app.use("/api", limiter);

app.set("json replacer", (_k: string, v: unknown) => typeof v === "bigint" ? v.toString() : v);
app.set("trust proxy", 1);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Services
const priceService = new PriceService({ ids: ["ethereum", "reactive-network"], intervalMs: 45_000 });
priceService.start();
app.locals.priceService = priceService;

// DB & Points
const prisma = new PrismaClient();
const chainKeys = ["mainnet", "base", "arb"] as ChainKey[];

const points = new BridgePointsService({ prisma, chainKeys });
points.start();

app.use("/api", routesFactory({ prisma, points }));

// 404 + error
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: err.issues });
  const status = err.status || 500, msg = err.message || "Internal Server Error";
  console.error("[API ERROR]", msg);
  res.status(status).json({ error: msg });
});

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on :${PORT}`);
});

const shutdown = async () => {
  console.log("Shutting down...");
  try { priceService.stop?.(); } catch {}
  try { await points.stop(); } catch {}
  try { await prisma.$disconnect(); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);