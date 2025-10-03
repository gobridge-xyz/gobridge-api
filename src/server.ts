import express from "express";
import cors from "cors";
import routes from "./routes";
import dotenv from "dotenv";
import { PriceService } from "./priceService";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

// --- CORS ---
const allowlist = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.some(o => o && origin === o)) return cb(null, true);
    if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: "200kb" }));

app.options("*", cors());

const limiter = rateLimit({
  windowMs: 15 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || req.path === "/health",
});
app.use("/api", limiter);

// --- BigInt -> string serializer ---
app.set("json replacer", (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v
);

app.set("trust proxy", 1);

// --- healthcheck ---
app.get("/health", (_req, res) => res.json({ ok: true }));

const priceService = new PriceService({
  ids: ["ethereum", "reactive-network"],
  intervalMs: 30_000,
});
priceService.start();
app.locals.priceService = priceService;

app.use("/api", routes);

// --- 404 ---
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid request", details: err.errors });
  }
  const status = err.status || 500;
  const msg = err.message || "Internal Server Error";
  console.error("[API ERROR]", msg);
  res.status(status).json({ error: msg });
});

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  console.log("Shutting down...");
  try { priceService.stop?.(); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);