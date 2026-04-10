import graphData from "@/data/graph.json";
import historyData from "@/data/history.json";
import usersData from "@/data/users.json";
import type {
  Decision,
  LayerScore,
  Reason,
  SimulationInput,
  SimulationResult,
} from "@/lib/types";

type UserRecord = {
  id: string;
  name: string;
  avgAmount: number;
  behaviorBaseline: {
    typingDelay: number;
    mouseVelocity: number;
  };
  trustedDevices: string[];
  usualLocations: string[];
  preferredHours: number[];
};

type HistoryRecord = {
  amount: number;
  hour: number;
};

type GraphNode = {
  id: string;
  label: string;
  type: string;
  fraud?: boolean;
};

type GraphData = {
  nodes: GraphNode[];
  edges: [string, string][];
};

const users = usersData as UserRecord[];
const history = historyData as Record<string, HistoryRecord[]>;
const graph = graphData as GraphData;

const userById = new Map(users.map((user) => [user.id, user]));
const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

const HIGH_RISK_MERCHANT_CATEGORIES = new Set([
  "crypto_exchange",
  "gift_cards",
  "wire_transfer",
]);

const WEIGHTS = {
  behavior: 0.3,
  device: 0.2,
  anomaly: 0.25,
  graph: 0.25,
};

const adjacency = (() => {
  const map = new Map<string, Set<string>>();

  const add = (source: string, target: string) => {
    if (!map.has(source)) {
      map.set(source, new Set<string>());
    }
    map.get(source)?.add(target);
  };

  for (const [a, b] of graph.edges) {
    add(a, b);
    add(b, a);
  }

  return map;
})();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 1;
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, current) => sum + (current - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function shortestPathLength(
  source: string,
  target: string,
  maxDepth = 6,
): number {
  if (source === target) {
    return 0;
  }

  if (!adjacency.has(source) || !adjacency.has(target)) {
    return Number.POSITIVE_INFINITY;
  }

  const visited = new Set<string>([source]);
  const queue: Array<{ node: string; depth: number }> = [{ node: source, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = adjacency.get(current.node) ?? new Set<string>();
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }

      if (neighbor === target) {
        return current.depth + 1;
      }

      visited.add(neighbor);
      queue.push({ node: neighbor, depth: current.depth + 1 });
    }
  }

  return Number.POSITIVE_INFINITY;
}

function scoreBehavior(input: SimulationInput, user: UserRecord): LayerScore {
  const reasons: Reason[] = [];

  const typingDeviationPct =
    (Math.abs(input.behavior.avgTypingDelay - user.behaviorBaseline.typingDelay) /
      user.behaviorBaseline.typingDelay) *
    100;
  const mouseDeviationPct =
    (Math.abs(input.behavior.avgMouseVelocity - user.behaviorBaseline.mouseVelocity) /
      user.behaviorBaseline.mouseVelocity) *
    100;

  let score = typingDeviationPct * 0.55 + mouseDeviationPct * 0.45;

  if (input.behavior.sampleCount < 8) {
    score *= 0.75;
    reasons.push({
      feature: "Telemetry warming up",
      impact: 6,
      detail: "Behavioral sample count is low; confidence is reduced.",
      layer: "behavior",
    });
  }

  if (typingDeviationPct > 35) {
    reasons.push({
      feature: "Typing cadence mismatch",
      impact: clamp(typingDeviationPct * 0.8, 12, 34),
      detail: `Typing delay deviates ${typingDeviationPct.toFixed(1)}% from baseline.`,
      layer: "behavior",
    });
  }

  if (mouseDeviationPct > 30) {
    reasons.push({
      feature: "Mouse dynamics drift",
      impact: clamp(mouseDeviationPct * 0.7, 10, 28),
      detail: `Mouse velocity deviates ${mouseDeviationPct.toFixed(1)}% from baseline.`,
      layer: "behavior",
    });
  }

  if (input.flags.unusualBehavior) {
    score += 22;
    reasons.push({
      feature: "Unusual behavior scenario enabled",
      impact: 22,
      detail: "Manual stress toggle for atypical interaction pattern.",
      layer: "behavior",
    });
  }

  return { score: clamp(score), reasons };
}

function scoreDevice(input: SimulationInput, user: UserRecord): LayerScore {
  const reasons: Reason[] = [];
  let score = 0;

  const isTrustedDevice = user.trustedDevices.includes(input.deviceId);
  if (!input.knownDevice || !isTrustedDevice) {
    score += 30;
    reasons.push({
      feature: "Unrecognized device",
      impact: 30,
      detail: "Device fingerprint is not in trusted history.",
      layer: "device",
    });
  }

  const isKnownLocation = user.usualLocations.includes(input.location);
  if (input.locationChanged || !isKnownLocation) {
    score += 20;
    reasons.push({
      feature: "Location shift detected",
      impact: 20,
      detail: "Transaction location diverges from typical pattern.",
      layer: "device",
    });
  }

  if (input.flags.stolenDevice) {
    score += 35;
    reasons.push({
      feature: "Stolen device scenario enabled",
      impact: 35,
      detail: "Compromised endpoint simulation adds trust penalty.",
      layer: "device",
    });
  }

  if (input.amount > user.avgAmount * 2.2) {
    score += 10;
    reasons.push({
      feature: "Amount-device mismatch",
      impact: 10,
      detail: "High amount from uncertain device context.",
      layer: "device",
    });
  }

  return { score: clamp(score), reasons };
}

function scoreAnomaly(input: SimulationInput, user: UserRecord): LayerScore {
  const reasons: Reason[] = [];
  const userHistory = history[input.userId] ?? [];
  const amountHistory = userHistory.map((entry) => entry.amount);
  const avgAmount = amountHistory.length ? average(amountHistory) : user.avgAmount;
  const amountStd = Math.max(120, standardDeviation(amountHistory));

  const amountZ = Math.abs(input.amount - avgAmount) / amountStd;
  let score = amountZ * 20;

  if (amountZ > 1.5) {
    reasons.push({
      feature: "Amount outlier",
      impact: clamp(amountZ * 11, 12, 32),
      detail: `Amount is ${amountZ.toFixed(2)} standard deviations from norm.`,
      layer: "anomaly",
    });
  }

  if (!user.preferredHours.includes(input.transactionHour)) {
    score += 18;
    reasons.push({
      feature: "Temporal anomaly",
      impact: 18,
      detail: "Transaction time is outside preferred behavior window.",
      layer: "anomaly",
    });
  }

  if (HIGH_RISK_MERCHANT_CATEGORIES.has(input.merchantCategory)) {
    score += 12;
    reasons.push({
      feature: "Risky merchant category",
      impact: 12,
      detail: "Merchant category is often linked to rapid laundering.",
      layer: "anomaly",
    });
  }

  if (input.flags.muleAccount) {
    score += 14;
    reasons.push({
      feature: "Mule behavior pressure",
      impact: 14,
      detail: "Scenario hint raises anomaly suspicion.",
      layer: "anomaly",
    });
  }

  return { score: clamp(score), reasons };
}

function scoreGraph(input: SimulationInput): LayerScore {
  const reasons: Reason[] = [];
  const riskyNodes = graph.nodes.filter((node) => node.fraud).map((node) => node.id);
  const anchors = [input.userId, input.deviceId, input.merchantId];

  let minDistance = Number.POSITIVE_INFINITY;
  for (const source of anchors) {
    for (const target of riskyNodes) {
      const distance = shortestPathLength(source, target);
      minDistance = Math.min(minDistance, distance);
    }
  }

  let score = 8;
  if (minDistance === 1) {
    score = 78;
    reasons.push({
      feature: "Direct fraud-ring adjacency",
      impact: 36,
      detail: "An anchor entity is directly connected to a risky node.",
      layer: "graph",
    });
  } else if (minDistance === 2) {
    score = 56;
    reasons.push({
      feature: "Two-hop fraud proximity",
      impact: 26,
      detail: "Entity path reaches known risky node within two hops.",
      layer: "graph",
    });
  } else if (minDistance === 3) {
    score = 32;
    reasons.push({
      feature: "Weak fraud-link signal",
      impact: 16,
      detail: "Relationship graph contains distant risky connectivity.",
      layer: "graph",
    });
  }

  if (input.flags.muleAccount) {
    score += 24;
    reasons.push({
      feature: "Mule account scenario enabled",
      impact: 24,
      detail: "Known mule behavior mapped to linked accounts.",
      layer: "graph",
    });
  }

  if (input.flags.stolenDevice) {
    score += 10;
    reasons.push({
      feature: "Compromised endpoint in graph",
      impact: 10,
      detail: "Device-risk context increases graph propagation risk.",
      layer: "graph",
    });
  }

  if (HIGH_RISK_MERCHANT_CATEGORIES.has(input.merchantCategory)) {
    score += 10;
  }

  return { score: clamp(score), reasons };
}

function inferDecision(riskScore: number): Decision {
  if (riskScore < 30) {
    return "ALLOW";
  }

  if (riskScore < 60) {
    return "STEP-UP";
  }

  if (riskScore < 80) {
    return "DELAY";
  }

  return "BLOCK";
}

function buildGraphTopology(input: SimulationInput): SimulationResult["graphTopology"] {
  const center = new Set([input.userId, input.deviceId, input.merchantId]);

  for (const id of Array.from(center)) {
    const neighbors = adjacency.get(id);
    if (!neighbors) {
      continue;
    }

    for (const neighbor of neighbors) {
      center.add(neighbor);
    }
  }

  const riskyNodes = graph.nodes.filter((node) => node.fraud);
  for (const node of riskyNodes) {
    const distance = Math.min(
      shortestPathLength(input.userId, node.id),
      shortestPathLength(input.deviceId, node.id),
      shortestPathLength(input.merchantId, node.id),
    );

    if (distance <= 2 || input.flags.muleAccount) {
      center.add(node.id);
    }
  }

  const nodes = Array.from(center).map((id) => {
    const found = nodeById.get(id);
    if (found) {
      return found;
    }

    if (id === input.deviceId) {
      return { id, label: "Live Device", type: "device" };
    }

    if (id === input.merchantId) {
      return { id, label: "Live Merchant", type: "merchant" };
    }

    return { id, label: id, type: "external" };
  });

  const nodeSet = new Set(nodes.map((node) => node.id));
  const edges = graph.edges
    .filter(([source, target]) => nodeSet.has(source) && nodeSet.has(target))
    .map(([source, target]) => ({ source, target }));

  return { nodes, edges };
}

function toFixed(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals));
}

export function getUserName(userId: string): string {
  return userById.get(userId)?.name ?? "Unknown User";
}

export async function simulateTransaction(
  input: SimulationInput,
): Promise<SimulationResult> {
  const startedAt = performance.now();
  const user = userById.get(input.userId) ?? users[0];

  const behavior = scoreBehavior(input, user);
  const device = scoreDevice(input, user);
  const anomaly = scoreAnomaly(input, user);
  const graphLayer = scoreGraph(input);

  let riskScore =
    behavior.score * WEIGHTS.behavior +
    device.score * WEIGHTS.device +
    anomaly.score * WEIGHTS.anomaly +
    graphLayer.score * WEIGHTS.graph;

  if (input.flags.stolenDevice && input.flags.muleAccount) {
    riskScore += 7;
  }

  riskScore = clamp(riskScore);

  const reasons = [...behavior.reasons, ...device.reasons, ...anomaly.reasons, ...graphLayer.reasons]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6);

  if (!reasons.length) {
    reasons.push({
      feature: "Stable transaction profile",
      impact: 8,
      detail: "Signals align with historical baseline behavior.",
      layer: "anomaly",
    });
  }

  const decision = inferDecision(riskScore);
  const graphTopology = buildGraphTopology(input);
  const latencyMs = Math.round(performance.now() - startedAt + 110 + Math.random() * 120);
  const confidence = clamp(74 + reasons.length * 2.8 + Math.abs(riskScore - 50) * 0.15, 70, 98.6);

  const delay = Math.min(700, 180 + Math.round(riskScore * 3));
  await wait(delay);

  return {
    userId: input.userId,
    riskScore: toFixed(riskScore),
    decision,
    confidence: toFixed(confidence),
    breakdown: {
      behavior: toFixed(behavior.score),
      device: toFixed(device.score),
      anomaly: toFixed(anomaly.score),
      graph: toFixed(graphLayer.score),
    },
    reasons,
    latencyMs,
    timestamp: new Date().toISOString(),
    graphTopology,
    logs: [
      `Session user: ${user.name}`,
      `Device signal: ${input.knownDevice ? "known" : "new"}`,
      `Location signal: ${input.locationChanged ? "changed" : "stable"}`,
      `Decision policy output: ${decision}`,
    ],
  };
}

export function decisionTone(decision: Decision): "good" | "warn" | "danger" {
  if (decision === "ALLOW") {
    return "good";
  }

  if (decision === "STEP-UP" || decision === "DELAY") {
    return "warn";
  }

  return "danger";
}
