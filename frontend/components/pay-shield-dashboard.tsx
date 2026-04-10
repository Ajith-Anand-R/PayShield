"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useBehaviorTracker } from "@/hooks/use-behavior-tracker";
import { decisionTone, getUserName, simulateTransaction } from "@/lib/simulator";
import type { ScenarioFlags, SimulationInput, SimulationResult } from "@/lib/types";

type FormState = {
  userId: string;
  amount: number;
  deviceId: string;
  knownDevice: boolean;
  location: string;
  locationChanged: boolean;
  transactionHour: number;
  merchantId: string;
};

type PresetKey = "normal" | "stolen_device" | "fraud_ring" | "unusual_behavior";

type MerchantOption = {
  id: string;
  label: string;
  category: string;
};

const STORAGE_KEY = "payshield.simulation.history";

const USERS = [
  { id: "user_001", label: "Anika Rao" },
  { id: "user_002", label: "Raghav S" },
];

const DEVICES = [
  { id: "device_iphone_14", label: "Known iPhone" },
  { id: "device_macbook_air", label: "Known MacBook" },
  { id: "device_pixel_8", label: "Known Pixel" },
  { id: "device_unknown_x", label: "Unknown Device" },
];

const LOCATIONS = ["Chennai", "Bengaluru", "Hyderabad", "Mumbai", "Delhi"];

const MERCHANTS: MerchantOption[] = [
  { id: "merchant_local_grocery", label: "Local Grocery", category: "retail" },
  { id: "merchant_electro_mall", label: "Electro Mall", category: "electronics" },
  { id: "merchant_shell_92", label: "Shell Merchant 92", category: "wire_transfer" },
  { id: "merchant_crypto_swap", label: "Crypto Exchange", category: "crypto_exchange" },
];

const DEFAULT_FORM: FormState = {
  userId: "user_001",
  amount: 1920,
  deviceId: "device_iphone_14",
  knownDevice: true,
  location: "Chennai",
  locationChanged: false,
  transactionHour: 11,
  merchantId: "merchant_local_grocery",
};

const DEFAULT_FLAGS: ScenarioFlags = {
  stolenDevice: false,
  muleAccount: false,
  unusualBehavior: false,
};

const PRESETS: Record<
  PresetKey,
  {
    title: string;
    description: string;
    form: FormState;
    flags: ScenarioFlags;
  }
> = {
  normal: {
    title: "Normal Payment",
    description: "Trusted user and expected context should produce ALLOW.",
    form: {
      userId: "user_001",
      amount: 1980,
      deviceId: "device_iphone_14",
      knownDevice: true,
      location: "Chennai",
      locationChanged: false,
      transactionHour: 10,
      merchantId: "merchant_local_grocery",
    },
    flags: {
      stolenDevice: false,
      muleAccount: false,
      unusualBehavior: false,
    },
  },
  stolen_device: {
    title: "Stolen Device",
    description: "Compromised endpoint should trigger STEP-UP or DELAY.",
    form: {
      userId: "user_001",
      amount: 2860,
      deviceId: "device_unknown_x",
      knownDevice: false,
      location: "Mumbai",
      locationChanged: true,
      transactionHour: 23,
      merchantId: "merchant_electro_mall",
    },
    flags: {
      stolenDevice: true,
      muleAccount: false,
      unusualBehavior: true,
    },
  },
  fraud_ring: {
    title: "Fraud Ring",
    description: "Mule pattern and graph links should drive BLOCK.",
    form: {
      userId: "user_002",
      amount: 7900,
      deviceId: "device_unknown_x",
      knownDevice: false,
      location: "Delhi",
      locationChanged: true,
      transactionHour: 2,
      merchantId: "merchant_shell_92",
    },
    flags: {
      stolenDevice: true,
      muleAccount: true,
      unusualBehavior: true,
    },
  },
  unusual_behavior: {
    title: "Unusual Behavior",
    description: "Behavioral drift with mixed context should trigger STEP-UP.",
    form: {
      userId: "user_001",
      amount: 3550,
      deviceId: "device_macbook_air",
      knownDevice: true,
      location: "Bengaluru",
      locationChanged: false,
      transactionHour: 6,
      merchantId: "merchant_crypto_swap",
    },
    flags: {
      stolenDevice: false,
      muleAccount: false,
      unusualBehavior: true,
    },
  },
};

function toTimeLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${period}`;
}

function statusBadgeClass(decision: SimulationResult["decision"]): string {
  const tone = decisionTone(decision);
  if (tone === "good") {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }
  if (tone === "warn") {
    return "border-amber-300/40 bg-amber-500/15 text-amber-100";
  }
  return "border-rose-300/40 bg-rose-500/15 text-rose-100";
}

function layerBarClass(layer: keyof SimulationResult["breakdown"]): string {
  if (layer === "behavior") {
    return "from-cyan-300 to-cyan-500";
  }
  if (layer === "device") {
    return "from-teal-300 to-teal-500";
  }
  if (layer === "anomaly") {
    return "from-amber-300 to-orange-500";
  }
  return "from-rose-300 to-rose-500";
}

function RiskGauge({
  value,
  decision,
}: {
  value: number;
  decision: SimulationResult["decision"];
}) {
  const tone = decisionTone(decision);
  const color =
    tone === "good" ? "#14b8a6" : tone === "warn" ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative mx-auto h-52 w-52">
      <div
        className="absolute inset-0 rounded-full shadow-[0_0_60px_rgba(15,23,42,0.45)]"
        style={{
          background: `conic-gradient(${color} ${value * 3.6}deg, rgba(203,213,225,0.16) 0deg)`,
        }}
      />
      <div className="absolute inset-[14px] rounded-full border border-white/10 bg-slate-950/95" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Risk Index
        </p>
        <p className="mt-1 text-5xl font-bold leading-none text-white">{value.toFixed(1)}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-300">out of 100</p>
      </div>
    </div>
  );
}

function GraphTopology({
  topology,
}: {
  topology: SimulationResult["graphTopology"] | null;
}) {
  const plotted = useMemo(() => {
    if (!topology) {
      return { nodes: [], edges: [] as Array<{ source: string; target: string }> };
    }

    const visibleNodes = topology.nodes.slice(0, 12);
    const radius = 94;
    const centerX = 160;
    const centerY = 120;

    const nodes = visibleNodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / visibleNodes.length;
      const jitter = node.type === "user" ? 0 : 20;
      return {
        ...node,
        x: centerX + (radius + jitter) * Math.cos(angle),
        y: centerY + (radius + jitter) * Math.sin(angle),
      };
    });

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const edges = topology.edges.filter(
      (edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target),
    );

    return { nodes, edges };
  }, [topology]);

  const nodeLookup = new Map(plotted.nodes.map((node) => [node.id, node]));

  if (!topology) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/65 text-sm text-slate-400">
        Run a simulation to inspect transaction graph topology.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
      <svg viewBox="0 0 320 240" className="h-64 w-full">
        {plotted.edges.map((edge, index) => {
          const source = nodeLookup.get(edge.source);
          const target = nodeLookup.get(edge.target);
          if (!source || !target) {
            return null;
          }

          return (
            <line
              key={`${edge.source}-${edge.target}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="rgba(148, 163, 184, 0.45)"
              strokeWidth="1.4"
            />
          );
        })}

        {plotted.nodes.map((node) => {
          const fill = node.fraud
            ? "#f43f5e"
            : node.type === "user"
              ? "#22d3ee"
              : node.type === "device"
                ? "#14b8a6"
                : node.type === "merchant"
                  ? "#f59e0b"
                  : "#cbd5e1";

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.type === "user" ? 10 : 7}
                fill={fill}
                stroke="rgba(15, 23, 42, 0.8)"
                strokeWidth="2"
              />
              <text
                x={node.x}
                y={node.y + 18}
                textAnchor="middle"
                className="fill-slate-300 text-[9px]"
              >
                {node.label.slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function PayShieldDashboard() {
  const behavior = useBehaviorTracker();
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("normal");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [flags, setFlags] = useState<ScenarioFlags>(DEFAULT_FLAGS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SimulationResult[]>([]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) {
        return;
      }

      const parsed = JSON.parse(cached) as SimulationResult[];
      if (Array.isArray(parsed)) {
        setSessionHistory(parsed.slice(0, 8));
      }
    } catch {
      setSessionHistory([]);
    }
  }, []);

  const merchantById = useMemo(
    () => new Map(MERCHANTS.map((merchant) => [merchant.id, merchant])),
    [],
  );

  const topReasons = result?.reasons.slice(0, 3) ?? [];

  const summary = result
    ? `${result.decision} with ${result.confidence.toFixed(1)}% confidence. Strongest signal: ${topReasons[0]?.feature ?? "stable profile"}.`
    : "No transaction simulated yet. Run a scenario to generate a decision.";

  const applyPreset = (preset: PresetKey) => {
    setSelectedPreset(preset);
    setForm(PRESETS[preset].form);
    setFlags(PRESETS[preset].flags);
  };

  const handleRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunning(true);

    try {
      const merchant = merchantById.get(form.merchantId) ?? MERCHANTS[0];
      const payload: SimulationInput = {
        userId: form.userId,
        amount: form.amount,
        deviceId: form.deviceId,
        knownDevice: form.knownDevice,
        location: form.location,
        locationChanged: form.locationChanged,
        transactionHour: form.transactionHour,
        merchantId: form.merchantId,
        merchantCategory: merchant.category,
        flags,
        behavior: {
          avgTypingDelay: behavior.avgTypingDelay,
          avgMouseVelocity: behavior.avgMouseVelocity,
          sampleCount: behavior.sampleCount,
        },
      };

      const simulationResult = await simulateTransaction(payload);
      setResult(simulationResult);
      setSessionHistory((current) => {
        const next = [simulationResult, ...current].slice(0, 8);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-3xl border border-white/15 bg-slate-950/75 p-5 backdrop-blur-xl md:p-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">
              PayShield v2
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Pre-Transaction Fraud Intelligence Simulator
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Demo-grade risk decisions powered by behavioral identity, anomaly signals,
              device trust, and graph relationships. No backend required.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200/20 bg-cyan-500/10 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-200">
              Live Telemetry
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-cyan-100">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Typing</p>
                <p className="text-base font-semibold">
                  {Math.round(behavior.avgTypingDelay)}ms
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Mouse</p>
                <p className="text-base font-semibold">
                  {behavior.avgMouseVelocity.toFixed(2)} px/ms
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Samples</p>
                <p className="text-base font-semibold">{behavior.sampleCount}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-3 lg:grid-cols-4">
          {(Object.entries(PRESETS) as Array<[PresetKey, (typeof PRESETS)[PresetKey]]>).map(
            ([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-2xl border p-3 text-left transition duration-200 ${
                  selectedPreset === key
                    ? "border-cyan-300/65 bg-cyan-400/15"
                    : "border-white/10 bg-slate-900/70 hover:border-cyan-300/40"
                }`}
              >
                <p className="text-sm font-semibold text-white">{preset.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{preset.description}</p>
              </button>
            ),
          )}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_1fr]">
          <form
            onSubmit={handleRun}
            className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">User</span>
                <select
                  value={form.userId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, userId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                >
                  {USERS.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Amount (INR)</span>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Device</span>
                <select
                  value={form.deviceId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, deviceId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                >
                  {DEVICES.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Merchant</span>
                <select
                  value={form.merchantId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, merchantId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                >
                  {MERCHANTS.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Location</span>
                <select
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, location: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none ring-cyan-300 transition focus:ring-2"
                >
                  {LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Hour</span>
                <input
                  type="range"
                  min={0}
                  max={23}
                  value={form.transactionHour}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transactionHour: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-cyan-400"
                />
                <p className="text-xs text-slate-300">{toTimeLabel(form.transactionHour)}</p>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({ ...current, knownDevice: !current.knownDevice }))
                }
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  form.knownDevice
                    ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-slate-950/70 text-slate-200"
                }`}
              >
                {form.knownDevice ? "Known Device" : "New Device"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    locationChanged: !current.locationChanged,
                  }))
                }
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  form.locationChanged
                    ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
                    : "border-white/10 bg-slate-950/70 text-slate-200"
                }`}
              >
                {form.locationChanged ? "Location Changed" : "Location Stable"}
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fraud Scenario Toggles</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["stolenDevice", "Stolen Device"],
                    ["muleAccount", "Mule Account"],
                    ["unusualBehavior", "Unusual Behavior"],
                  ] as Array<[keyof ScenarioFlags, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setFlags((current) => ({ ...current, [key]: !current[key] }))
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                      flags[key]
                        ? "border-rose-300/45 bg-rose-500/15 text-rose-100"
                        : "border-white/10 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={running}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Evaluating Risk..." : "Simulate Transaction"}
            </button>
          </form>

          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            {result ? (
              <>
                <RiskGauge value={result.riskScore} decision={result.decision} />

                <div className="mt-4 flex items-center justify-center">
                  <span
                    className={`rounded-full border px-4 py-2 text-sm font-black uppercase tracking-[0.18em] ${statusBadgeClass(
                      result.decision,
                    )}`}
                  >
                    {result.decision}
                  </span>
                </div>

                <p className="mt-4 text-center text-sm leading-6 text-slate-200">{summary}</p>

                <div className="mt-5 space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Layer Contributions
                  </p>
                  {(Object.entries(result.breakdown) as Array<
                    [keyof SimulationResult["breakdown"], number]
                  >).map(([layer, value]) => (
                    <div key={layer}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                        <span className="uppercase tracking-[0.18em]">{layer}</span>
                        <span>{value.toFixed(1)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700/60">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${layerBarClass(layer)}`}
                          style={{ width: `${Math.min(100, value)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/65 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Top Reasons</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {topReasons.map((reason) => (
                      <li key={`${reason.layer}-${reason.feature}`}>
                        <p className="font-semibold text-white">{reason.feature}</p>
                        <p className="text-xs text-slate-300">{reason.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2">
                    <p className="uppercase tracking-[0.2em] text-slate-400">Latency</p>
                    <p className="mt-1 font-mono text-sm text-white">{result.latencyMs} ms</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2">
                    <p className="uppercase tracking-[0.2em] text-slate-400">Confidence</p>
                    <p className="mt-1 font-mono text-sm text-white">
                      {result.confidence.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[500px] items-center justify-center rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
                Configure a scenario and click Simulate Transaction to see risk decision,
                explainability, and graph evidence.
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Graph Evidence</p>
            <h2 className="mt-2 text-xl font-bold text-white">Fraud Ring Topology</h2>
            <p className="mt-1 text-sm text-slate-300">
              Network proximity to known risky entities amplifies graph risk.
            </p>
            <div className="mt-4">
              <GraphTopology topology={result?.graphTopology ?? null} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Session Trace</p>
            <h2 className="mt-2 text-xl font-bold text-white">Recent Decisions</h2>
            <p className="mt-1 text-sm text-slate-300">
              Stored locally in browser memory for demo continuity.
            </p>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-200">
                  {sessionHistory.length ? (
                    sessionHistory.map((entry, index) => (
                      <tr key={`${entry.timestamp}-${index}`}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 text-xs">{getUserName(entry.userId)}</td>
                        <td className="px-3 py-2 font-semibold">{entry.riskScore.toFixed(1)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${statusBadgeClass(
                              entry.decision,
                            )}`}
                          >
                            {entry.decision}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-6 text-center text-xs text-slate-400" colSpan={4}>
                        No simulations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {result ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Engine Logs</p>
            <ul className="mt-2 grid gap-1 md:grid-cols-2">
              {result.logs.map((logLine) => (
                <li key={logLine} className="font-mono text-xs text-slate-200/90">
                  {logLine}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
