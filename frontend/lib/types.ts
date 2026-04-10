export type Decision = "ALLOW" | "STEP-UP" | "DELAY" | "BLOCK";

export interface ScenarioFlags {
  stolenDevice: boolean;
  muleAccount: boolean;
  unusualBehavior: boolean;
}

export interface BehaviorSnapshot {
  avgTypingDelay: number;
  avgMouseVelocity: number;
  sampleCount: number;
}

export interface SimulationInput {
  userId: string;
  amount: number;
  deviceId: string;
  knownDevice: boolean;
  location: string;
  locationChanged: boolean;
  transactionHour: number;
  merchantId: string;
  merchantCategory: string;
  flags: ScenarioFlags;
  behavior: BehaviorSnapshot;
}

export interface Reason {
  feature: string;
  impact: number;
  detail: string;
  layer: "behavior" | "device" | "anomaly" | "graph";
}

export interface LayerScore {
  score: number;
  reasons: Reason[];
}

export interface SimulationResult {
  userId: string;
  riskScore: number;
  decision: Decision;
  confidence: number;
  breakdown: {
    behavior: number;
    device: number;
    anomaly: number;
    graph: number;
  };
  reasons: Reason[];
  latencyMs: number;
  timestamp: string;
  graphTopology: {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      fraud?: boolean;
    }>;
    edges: Array<{ source: string; target: string }>;
  };
  logs: string[];
}
