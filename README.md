# GoBridge API (Fee & Quote Service)

A minimal TypeScript/Express service that **quotes bridge fees**, **signs requests**, and helps users route with the **best fees and bridge rates** for GoBridge.

## Features
- 🌉 Bridge fee & min-out **calculations**
- 🔏 Server-side **signing** flow
- 🛡️ Production-ready middleware: **helmet**, **rate-limit**, **CORS**
- 🩺 Health endpoint at `/health`
- 🧩 Clean JSON responses (BigInt → string)

## Quick Start
```bash
pnpm i
pnpm dev
# open http://localhost:4000/health
```

## Scripts
- `pnpm dev` – local dev with `ts-node-dev`
- `pnpm build` – compile TypeScript to `dist/`
- `pnpm start` – run compiled app (uses `dist/bin/start.js` or `dist/src/server.js` depending on your setup)

## Environment
Create an `.env` (or set via your host) with at least:
```
# Frontend origin allowed by CORS
FRONTEND_URL=https://your-frontend.example

# RPC endpoints (examples – rename to what your code expects)
RPC_MAINNET=...
RPC_BASE=...
RPC_REACTIVE=...

# Optional: signer key if server signs payloads on-chain
SIGNER_PRIVATE_KEY=...
```

> **Never commit** real secrets. Keep `.env` out of git (already ignored). Provide an `.env.example` if you want to document variables.

## Deploy (quick options)
### Railway / Render
- **Build:** `pnpm i --frozen-lockfile && pnpm build`
- **Start:** `pnpm start`
- Set **Environment Variables** in the dashboard (see above).
- The platform injects `PORT`; the server already reads `process.env.PORT`.

### Google Cloud Run (container)
- Build & push an image, then:
```bash
gcloud run deploy gobridge-api --image gcr.io/<PROJECT>/<IMAGE> --region=europe-west1 --allow-unauthenticated
```
The app listens on `PORT` provided by the platform.

## Endpoints
- `GET /health` – liveness probe
- `POST /api/...` – fee/quote endpoints under `/api` (see `routes/` in your codebase)

## Security Notes
- `helmet` enabled; `crossOriginOpenerPolicy: same-origin-allow-popups` recommended if you use OAuth/popups.
- CORS is **allowlist-based**; set `FRONTEND_URL` in env.
- Rate limiter attached to `/api` (tune `windowMs` & `max` if needed).

## Observability
- Server logs to stdout.
- Add a log drain or APM (Railway/Render/GCP integrate easily) for prod.
