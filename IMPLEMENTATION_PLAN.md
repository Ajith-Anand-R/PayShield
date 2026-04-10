# PayShield v2 - Hackathon Implementation Plan (Frontend-First, Full Simulation)

## Objective
Build a fully functional prototype in a few hours that demonstrates real-time fraud decision intelligence without production infrastructure.

Guiding principle: **simulate intelligence, not infrastructure**.

## Final Demo Scope
- Branded app name: **PayShield**
- Frontend-first prototype (Next.js + Tailwind)
- No real backend or database calls
- Local simulation engine + local JSON data
- Real-time risk scoring + explainability

## Product Story for Judges
- Detect fraud **before** payment execution
- Verify identity with **behavioral signals**
- Detect hidden fraud rings with **graph relationships**
- Take adaptive action: ALLOW / STEP-UP / DELAY / BLOCK

## Build Architecture (Prototype)
1. Next.js UI captures transaction + behavior telemetry
2. Local simulation engine computes risk layers
3. Policy engine returns decision in milliseconds
4. UI shows score, decision, top reasons, and supporting evidence

## Frontend Feature Set

### 1) Transaction Simulator Panel
Inputs:
- amount
- device status (known/new)
- location status (expected/new)
- transaction hour
- merchant category

Scenario toggles:
- stolen device
- mule account
- unusual behavior

### 2) Behavioral DNA Capture (Browser SDK style)
Capture in browser:
- keydown intervals
- mouse movement velocity

Derived metrics:
- avg typing delay
- avg mouse velocity
- deviation from user baseline

### 3) Risk Engine (Local)
Risk layers:
- behavior risk
- device trust risk
- anomaly risk (IsolationForest-like heuristic using synthetic history)
- graph risk (ring proximity from local graph)

Aggregation:
- weighted composite score (0-100)

Policy:
- < 30 ALLOW
- < 60 STEP-UP
- < 80 DELAY
- >= 80 BLOCK

### 4) Explainability Panel
Show:
- top 3 reasons by impact
- per-layer contribution chart
- decision rationale sentence

### 5) Demo Modes
One-click presets:
- normal payment
- stolen device
- fraud ring

### 6) Session History
Local-only transaction history:
- score
- decision
- scenario
- timestamp

## Local Data Model (JSON)
- users.json: baseline behavior, normal amount, trusted device/location
- graph.json: user-device-merchant links and risky nodes
- history.json: synthetic historical transactions

## Time-Boxed Execution Plan (Few Hours)

### Phase 1 (0-45 min)
- Scaffold Next.js app
- Set visual design system and PayShield branding
- Build page shell and simulator form

### Phase 2 (45-120 min)
- Implement behavior tracker hook
- Implement simulation engine modules
- Add scenario presets and decision pipeline

### Phase 3 (120-180 min)
- Build explainability + charts + graph panel
- Add local history and polish animations
- Validate responsiveness and demo flow

## What We Intentionally Skip
- real backend APIs
- real Supabase integration
- queues/stream infra
- heavy model training pipelines

## Success Criteria
- Fast end-to-end decision loop (< 500ms simulated)
- Distinct outputs for each fraud scenario
- Clear, credible explainability in UI
- Strong storytelling and polish for hackathon judges
