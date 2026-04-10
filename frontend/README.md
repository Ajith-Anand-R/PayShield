# PayShield Frontend Prototype

Frontend-only fraud intelligence simulator for hackathon demos.

## Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Local JSON datasets (no backend, no DB)

## What This Prototype Demonstrates
- Pre-transaction risk scoring
- Behavioral identity signals (typing + mouse telemetry)
- Device trust rules
- Anomaly scoring from synthetic history
- Graph-based fraud-ring proximity
- Adaptive policy decisions: ALLOW / STEP-UP / DELAY / BLOCK
- Explainability with top reasons and per-layer breakdown

## Run Locally
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Script (Judges)
1. Select `Normal Payment` and run simulation -> expected `ALLOW`.
2. Select `Stolen Device` and run simulation -> expected `STEP-UP` or `DELAY`.
3. Select `Fraud Ring` and run simulation -> expected `BLOCK`.
4. Highlight top 3 explainability reasons and graph topology panel.

## Data Sources
- `data/users.json`
- `data/history.json`
- `data/graph.json`

## Core Logic
- `lib/simulator.ts`
- `hooks/use-behavior-tracker.ts`
- `components/pay-shield-dashboard.tsx`
