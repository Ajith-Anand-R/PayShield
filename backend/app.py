from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import random

from database import SessionLocal, engine
import models
from ml.anomaly import AnomalyEngine
from ml.graph import GraphIntelligence

# Initialize Database
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PayShield Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML Engines
anomaly_engine = AnomalyEngine()
graph_intel = GraphIntelligence()

# --- SCHEMAS ---
class TransactionIn(BaseModel):
    user_id: str
    device_id: str
    amount: float
    scenario: str  # For simulation (normal, takeover, mule)

class RiskResponse(BaseModel):
    status: str  # ALLOW, STEP-UP, BLOCK
    risk_score: float
    confidence: float
    breakdown: dict
    graph_topology: dict
    logs: List[str]

# --- ENDPOINTS ---

@app.post("/simulate-risk", response_model=RiskResponse)
async def simulate_risk(tx: TransactionIn):
    logs = [f"[SYSTEM] SECURE INFERENCE HANDSHAKE: TX_ID_{random.randint(1000, 9999)}"]
    
    # Layer 1: Behavioral DNA (Simulated for Demo)
    b_score = 0
    if tx.scenario == "takeover":
        b_score = random.randint(75, 95)
        logs.append(f"[BEHAVIOR] ALERT: BIOMETRIC CADENCE DEVIATION ({b_score}%)")
    else:
        b_score = random.randint(5, 25)
        logs.append(f"[BEHAVIOR] BIOMETRIC MATCH: USER_HASH_8F")
        
    # Layer 2: Device Trust
    # In a real app, device_id would be checked against history
    d_score = random.randint(30, 60) if tx.scenario == "takeover" else random.randint(5, 20)
    logs.append(f"[DEVICE] FINGERPRINT REPUTATION: {d_score}% RISK")
    
    # Layer 3: Anomaly Engine (IsolationForest)
    hour = datetime.now().hour
    # Adding some specific bias based on scenario
    a_score = anomaly_engine.score(tx.amount, hour)
    if tx.scenario == "mule": a_score += random.randint(30, 50)
    a_score = min(100, max(0, a_score))
    logs.append(f"[ANOMALY] ISOLATION FOREST CLUSTER ANALYSIS: {int(a_score)}% DEVIATION")
    
    # Layer 4: Graph Intelligence (NetworkX)
    # Using User1 for Normal, User2 for Mule
    target_user = "U1" if tx.scenario != "mule" else "U2"
    g_score = graph_intel.score(target_user, tx.device_id)
    topology = graph_intel.get_topology(target_user)
    logs.append(f"[GRAPH] TOPOLOGY MAP COMPLETION: {int(g_score)}% RISK PATH")
    
    # Risk Aggregation (Weights: 40% Behavior, 10% Device, 20% Anomaly, 30% Graph)
    total_risk = (b_score * 0.4) + (d_score * 0.1) + (a_score * 0.2) + (g_score * 0.3)
    total_risk = min(100, max(0, total_risk))
    
    decision = "ALLOW"
    if total_risk > 70: decision = "BLOCK"
    elif total_risk > 40: decision = "STEP-UP"
    
    return {
        "status": decision,
        "risk_score": total_risk,
        "confidence": 95.0 + random.random() * 4,
        "breakdown": {
            "behavior": b_score,
            "device": d_score,
            "anomaly": a_score,
            "graph": g_score
        },
        "graph_topology": topology,
        "logs": logs
    }
