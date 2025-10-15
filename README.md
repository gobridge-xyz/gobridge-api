# GoBridge API

Minimal Node/TS service that powers **GoBridge**:
- Indexes bridge events (`BridgeInitialized`, `BridgeFinalized`) from EVM chains via **HTTP polling** (no filters).
- **Persists bridge history & user points** to **PostgreSQL (Prisma)**, exposes a small **REST API** (points, levels, history).
- Provides **quote & cost estimation** via `calculateBridge` endpoints to help the GoBridge frontend show expected output/fees before submit.

## Quick Start

```bash
pnpm i
cp .env.example .env   # fill values
pnpm prisma migrate dev
pnpm dev               # http://localhost:4000
```

Health check: `GET /health` → `ok`

## Scripts

- `pnpm dev` – run in watch mode
- `pnpm build` – compile TypeScript → `dist/`
- `pnpm start` – `node dist/server.js`
- `pnpm start:prod` – `prisma migrate deploy` + start
- `pnpm migrate:dev` / `pnpm migrate:deploy` – Prisma migrations
- `pnpm prisma:generate` – generate Prisma client

## API (brief)

- `GET /health` – service health
- `GET /api/points/:address` – user points, level, thresholds, progress
- `GET /api/bridges?address=0x..&limit=100` – recent bridges for a wallet
- `POST /api/calculate` – **calculateBridge**: returns estimated output/fees/slippage for a source→destination swap+bridge

### calculateBridge (what it does)

The `calculateBridge` service/route (see `src/routes/calculate.ts`, `src/services/calculateBridge.ts`) takes a payload like:

```json
{
  "fromChain": "base",
  "toChain": "mainnet",
  "fromToken": "0x...",
  "toToken": "0x...",
  "amountIn": "1000000000000000000"
}
```

and computes a **quote** by combining:
- **On-chain quoter(s)** (e.g. Uniswap quoter) for swap legs (`src`/`dest` swap paths),
- **Bridge fees** (e.g. `rnkFee`, `destFee`) and protocol overhead,
- **Gas shape**/execution hints (if available from contracts),
- **Slippage guard** → provides `minAmountOut` and an expected `amountOut`.

Returned fields typically include:
- `amountIn`, `minAmountOut`, `expectedAmountOut`,
- `rnkFee`, `destFee`, `estimatedGas` (if available),
- normalized token/chain metadata used by the frontend.

> The GoBridge frontend uses this endpoint to display **“You’ll receive …”** and fees before calling the on-chain `initiateBridge`.

## How It Works (very short)

- **Indexer**: HTTP `getLogs` polling with **adaptive block ranges** and **confirmations**. No `eth_newFilter`/WS filters → reliable on public RPCs.
- **Cursors** per `(chainKey,eventName)` make indexing **resumable** across restarts.
- **Persistence**: When `BridgeInitialized`/`BridgeFinalized` are seen, the service writes to Postgres:
  - `Bridge` rows (from/to chains, tx hashes, timestamps, duration),
  - **User points** (base + per-chain bonuses) in `UserPoints`,
  - **Cursor** state for each chain/event.
- **GoBridge connection**: This API is the backend companion for the **GoBridge** app. GoBridge calls:
  - `POST /api/calculate` to get quotes,
  - `GET /api/points/:address` and `GET /api/bridges?...` to render user profile (history, points, levels).

## Environment

Create `.env` (see `.env.example`):

```
DATABASE_URL=postgres://...
LEVEL_THRESHOLDS=0,300,800,1600,...
POINTS_PER_BRIDGE=85
BONUS_ETH=5
BONUS_ARB=3
BONUS_BASE=4
FRONTEND_URL=http://localhost:3000

# HTTP RPCs
RPC_MAINNET=
RPC_ARB=
RPC_BASE=

# Contracts
BRIDGE_MAINNET=
BRIDGE_ARB=
BRIDGE_BASE=
```

> Server binds to `0.0.0.0` and uses `PORT` (Railway sets it automatically).

## Deploy on Railway

1. Push repo to GitHub (don’t commit `.env`).
2. Railway → **New Project → Deploy from GitHub**.
3. Add **Postgres** plugin and connect → `DATABASE_URL` is injected.
4. Add env vars (RPCs, bonuses, etc.). Don’t set `PORT`.
5. Build: `pnpm install --frozen-lockfile && pnpm build`
6. Start: `pnpm start:prod`
7. (Optional) Health path: `/health`

The service backfills past events, then tails new ones; the frontend gets quotes via `calculateBridge` and sees persisted history/points from Postgres.
