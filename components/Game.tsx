"use client";

import { useReducer, useEffect, useRef, useState, useCallback } from "react";

// ─── WORM DATA ─────────────────────────────────────────────────────────────

const WORMS = [
  {
    id: "hank",
    name: "Hank",
    emoji: "🪱",
    flavor: "The smallest worm. Doesn't know it yet. Very confident.",
    baseCost: 10,
    baseDPS: 0.1,
  },
  {
    id: "larry",
    name: "Larry",
    emoji: "🪱",
    flavor: "Slightly larger than Hank. Reminds everyone of this constantly.",
    baseCost: 100,
    baseDPS: 0.8,
  },
  {
    id: "jerry",
    name: "Jerry",
    emoji: "🪱",
    flavor: "Getting up there in size. Has a newsletter about soil.",
    baseCost: 1_100,
    baseDPS: 5,
  },
  {
    id: "gary",
    name: "Gary",
    emoji: "🪱",
    flavor: "The biggest of the small worms. Gary takes this very seriously.",
    baseCost: 12_000,
    baseDPS: 25,
  },
  {
    id: "darilyn",
    name: "Darilyn",
    emoji: "🐍",
    flavor: "A big worm. Elegant. Powerful. Answers to no one.",
    baseCost: 130_000,
    baseDPS: 120,
  },
  {
    id: "matzobrei",
    name: "MatzoBrei",
    emoji: "🌍",
    flavor: "The biggest worm. Ancient. Unknowable. Possibly the earth itself.",
    baseCost: 1_400_000,
    baseDPS: 600,
  },
] as const;

type WormId = (typeof WORMS)[number]["id"];

// ─── UPGRADE DATA ──────────────────────────────────────────────────────────

type ClickUpgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: "click";
  multiplier: number;
  unlockTotalDirt: number;
};

type WormUpgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: "worm";
  worm: WormId;
  multiplier: number;
  unlockCount: number;
};

type Upgrade = ClickUpgrade | WormUpgrade;

const UPGRADES: Upgrade[] = [
  // Click upgrades
  { id: "sharp_teeth",    name: "Sharper Teeth",           description: "2× click power.",             cost: 100,         type: "click", multiplier: 2, unlockTotalDirt: 0 },
  { id: "mega_bite",      name: "Mega Bite",               description: "2× click power.",             cost: 5_000,       type: "click", multiplier: 2, unlockTotalDirt: 500 },
  { id: "vacuum_mouth",   name: "Vacuum Mouth",            description: "2× click power.",             cost: 500_000,     type: "click", multiplier: 2, unlockTotalDirt: 50_000 },

  // Hank upgrades
  { id: "hank_pep_talk",  name: "Pep Talk for Hank",       description: "Hanks produce 2×.",           cost: 500,         type: "worm", worm: "hank",      multiplier: 2, unlockCount: 1 },
  { id: "hank_hat",       name: "Hank's Little Hard Hat",  description: "Hanks produce 2×.",           cost: 5_000,       type: "worm", worm: "hank",      multiplier: 2, unlockCount: 10 },
  { id: "hank_union",     name: "Hank Unionizes",          description: "Hanks produce 2×.",           cost: 50_000,      type: "worm", worm: "hank",      multiplier: 2, unlockCount: 25 },

  // Larry upgrades
  { id: "larry_brag",     name: "Larry Brags About Size",  description: "Larrys produce 2×.",          cost: 5_000,       type: "worm", worm: "larry",     multiplier: 2, unlockCount: 1 },
  { id: "larry_shirt",    name: "Larry's Custom Shirt",    description: "Larrys produce 2×.",          cost: 50_000,      type: "worm", worm: "larry",     multiplier: 2, unlockCount: 10 },

  // Jerry upgrades
  { id: "jerry_sub",      name: "Jerry's Newsletter",      description: "Jerrys produce 2×.",          cost: 55_000,      type: "worm", worm: "jerry",     multiplier: 2, unlockCount: 1 },
  { id: "jerry_premium",  name: "Jerry Goes Premium",      description: "Jerrys produce 2×.",          cost: 550_000,     type: "worm", worm: "jerry",     multiplier: 2, unlockCount: 10 },

  // Gary upgrades
  { id: "gary_serious",   name: "Gary Is Very Serious",    description: "Garys produce 2×.",           cost: 600_000,     type: "worm", worm: "gary",      multiplier: 2, unlockCount: 1 },
  { id: "gary_meeting",   name: "Gary Calls a Meeting",    description: "Garys produce 2×.",           cost: 6_000_000,   type: "worm", worm: "gary",      multiplier: 2, unlockCount: 10 },

  // Darilyn upgrades
  { id: "darilyn_cape",   name: "Darilyn's Cape",          description: "Darilyns produce 2×.",        cost: 6_500_000,   type: "worm", worm: "darilyn",   multiplier: 2, unlockCount: 1 },
  { id: "darilyn_decree", name: "Darilyn Issues a Decree", description: "Darilyns produce 2×.",        cost: 65_000_000,  type: "worm", worm: "darilyn",   multiplier: 2, unlockCount: 10 },

  // MatzoBrei upgrades
  { id: "matzo_stirs",    name: "MatzoBrei Stirs",         description: "MatzoBrei produces 2×.",      cost: 70_000_000,  type: "worm", worm: "matzobrei", multiplier: 2, unlockCount: 1 },
  { id: "matzo_wakes",    name: "MatzoBrei Fully Wakes",   description: "MatzoBrei produces 2×.",      cost: 700_000_000, type: "worm", worm: "matzobrei", multiplier: 2, unlockCount: 10 },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  const tiers = [
    [1e24, "Sp"],
    [1e21, "Sx"],
    [1e18, "Qi"],
    [1e15, "Qa"],
    [1e12, "T"],
    [1e9,  "B"],
    [1e6,  "M"],
    [1e3,  "K"],
  ] as [number, string][];
  for (const [threshold, suffix] of tiers) {
    if (n >= threshold) {
      return (n / threshold).toFixed(1) + suffix;
    }
  }
  return Math.floor(n).toString();
}

function wormCost(baseCost: number, count: number): number {
  return Math.floor(baseCost * Math.pow(1.15, count));
}

// ─── STATE ────────────────────────────────────────────────────────────────

type GameState = {
  dirt: number;
  totalDirt: number;
  wormCounts: Partial<Record<WormId, number>>;
  purchasedUpgrades: string[];
  lastTick: number;
};

type Action =
  | { type: "CLICK" }
  | { type: "BUY_WORM"; id: WormId }
  | { type: "BUY_UPGRADE"; id: string }
  | { type: "TICK"; now: number }
  | { type: "LOAD"; state: GameState };

function calcDPS(state: GameState): number {
  let total = 0;
  for (const worm of WORMS) {
    const count = state.wormCounts[worm.id] ?? 0;
    if (count === 0) continue;
    let dps = worm.baseDPS * count;
    for (const u of UPGRADES) {
      if (u.type === "worm" && u.worm === worm.id && state.purchasedUpgrades.includes(u.id)) {
        dps *= u.multiplier;
      }
    }
    total += dps;
  }
  return total;
}

function calcClickValue(state: GameState): number {
  let val = 1;
  for (const u of UPGRADES) {
    if (u.type === "click" && state.purchasedUpgrades.includes(u.id)) {
      val *= u.multiplier;
    }
  }
  // Bonus: 1% of DPS per click
  val += calcDPS(state) * 0.01;
  return val;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "CLICK": {
      const gained = calcClickValue(state);
      return { ...state, dirt: state.dirt + gained, totalDirt: state.totalDirt + gained };
    }
    case "BUY_WORM": {
      const def = WORMS.find((w) => w.id === action.id);
      if (!def) return state;
      const count = state.wormCounts[action.id] ?? 0;
      const cost = wormCost(def.baseCost, count);
      if (state.dirt < cost) return state;
      return {
        ...state,
        dirt: state.dirt - cost,
        wormCounts: { ...state.wormCounts, [action.id]: count + 1 },
      };
    }
    case "BUY_UPGRADE": {
      const def = UPGRADES.find((u) => u.id === action.id);
      if (!def || state.purchasedUpgrades.includes(action.id)) return state;
      if (state.dirt < def.cost) return state;
      return {
        ...state,
        dirt: state.dirt - def.cost,
        purchasedUpgrades: [...state.purchasedUpgrades, action.id],
      };
    }
    case "TICK": {
      const elapsed = Math.min((action.now - state.lastTick) / 1000, 60);
      const earned = calcDPS(state) * elapsed;
      return {
        ...state,
        dirt: state.dirt + earned,
        totalDirt: state.totalDirt + earned,
        lastTick: action.now,
      };
    }
    case "LOAD":
      return action.state;
    default:
      return state;
  }
}

const INIT: GameState = {
  dirt: 0,
  totalDirt: 0,
  wormCounts: {},
  purchasedUpgrades: [],
  lastTick: Date.now(),
};

// ─── SAVE / LOAD ──────────────────────────────────────────────────────────

const SAVE_KEY = "losworm_v1";

function save(state: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch { return null; }
}

// ─── FLAVOR TEXT ──────────────────────────────────────────────────────────

function flavorText(totalDirt: number): string {
  if (totalDirt < 10)        return "The empire begins with a single worm...";
  if (totalDirt < 100)       return "The dirt trembles with possibility.";
  if (totalDirt < 1_000)     return "Your worms have found purpose.";
  if (totalDirt < 10_000)    return "Los Worm rises from the earth.";
  if (totalDirt < 100_000)   return "The tunnels stretch for miles.";
  if (totalDirt < 1_000_000) return "An empire beneath your feet.";
  if (totalDirt < 1e9)       return "The surface world knows not what stirs below.";
  if (totalDirt < 1e12)      return "Geologists are baffled.";
  return "The Great Worm stirs. All dirt is yours.";
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

type Floatie = { id: number; x: number; y: number; value: string };

export default function Game() {
  const [state, dispatch] = useReducer(reducer, INIT);
  const [clicking, setClicking] = useState(false);
  const [floaties, setFloaties] = useState<Floatie[]>([]);
  const floatId = useRef(0);
  const initialized = useRef(false);

  // Load save + apply offline progress
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = load();
    if (!saved) return;
    const now = Date.now();
    const elapsed = (now - saved.lastTick) / 1000;
    if (elapsed > 0) {
      const dps = calcDPS(saved);
      const offline = dps * Math.min(elapsed, 8 * 3600);
      saved.dirt += offline;
      saved.totalDirt += offline;
      saved.lastTick = now;
    }
    dispatch({ type: "LOAD", state: saved });
  }, []);

  // Auto-save every 10s
  useEffect(() => {
    const id = setInterval(() => save(state), 10_000);
    return () => clearInterval(id);
  }, [state]);

  // Game tick
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 100);
    return () => clearInterval(id);
  }, []);

  const dps = calcDPS(state);
  const clickValue = calcClickValue(state);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    dispatch({ type: "CLICK" });
    setClicking(true);
    setTimeout(() => setClicking(false), 80);
    const rect = e.currentTarget.getBoundingClientRect();
    const id = floatId.current++;
    const floatie: Floatie = {
      id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      value: `+${fmt(clickValue)}`,
    };
    setFloaties((f) => [...f, floatie]);
    setTimeout(() => setFloaties((f) => f.filter((x) => x.id !== id)), 850);
  }, [clickValue]);

  const availableUpgrades = UPGRADES.filter((u) => {
    if (state.purchasedUpgrades.includes(u.id)) return false;
    if (u.type === "click") return state.totalDirt >= u.unlockTotalDirt;
    if (u.type === "worm")  return (state.wormCounts[u.worm] ?? 0) >= u.unlockCount;
    return false;
  });

  const handleReset = () => {
    if (window.confirm("Wipe your entire worm empire? This is permanent.")) {
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    }
  };

  const ownedWorms = WORMS.filter((w) => (state.wormCounts[w.id] ?? 0) > 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#1a0f00",
        color: "#d4a96a",
        fontFamily: "'Courier New', monospace",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: "#0d0700",
          borderBottom: "1px solid #3d2400",
          padding: "10px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0d060", letterSpacing: 4 }}>
            LOS WORM
          </div>
          <div style={{ fontSize: 10, color: "#5a3c10", letterSpacing: 2 }}>
            WORM EMPIRE BUILDER
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f0d060" }}>
            {fmt(state.dirt)}{" "}
            <span style={{ fontSize: 14, color: "#a07040" }}>dirt</span>
          </div>
          <div style={{ fontSize: 12, color: "#7a5c30" }}>
            {fmt(dps)}/sec &nbsp;·&nbsp; {fmt(clickValue)}/click
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: CLICKER ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            background: "#120a00",
            padding: 24,
            overflow: "hidden",
          }}
        >
          {/* Clickable worm */}
          <div style={{ position: "relative" }}>
            <button
              onClick={handleClick}
              style={{
                fontSize: 100,
                lineHeight: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                userSelect: "none",
                transform: clicking ? "scale(0.9)" : "scale(1)",
                transition: "transform 0.08s ease",
              }}
              className={clicking ? "" : "worm-idle"}
            >
              🪱
            </button>
            {floaties.map((f) => (
              <div
                key={f.id}
                className="float-up"
                style={{
                  position: "absolute",
                  left: f.x,
                  top: f.y,
                  pointerEvents: "none",
                  color: "#f0d060",
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                {f.value}
              </div>
            ))}
          </div>

          {/* Flavor text */}
          <div
            style={{
              color: "#5a3c10",
              fontSize: 13,
              fontStyle: "italic",
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {flavorText(state.totalDirt)}
          </div>

          {/* Worm summary grid */}
          {ownedWorms.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: 8,
                width: "100%",
                maxWidth: 380,
              }}
            >
              {ownedWorms.map((w) => (
                <div
                  key={w.id}
                  style={{
                    background: "#1a0f00",
                    border: "1px solid #3d2400",
                    borderRadius: 8,
                    padding: "8px 4px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{w.emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#f0d060" }}>
                    {state.wormCounts[w.id]}
                  </div>
                  <div style={{ fontSize: 9, color: "#5a3c10", wordBreak: "break-word" }}>
                    {w.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total dirt ever */}
          <div style={{ fontSize: 11, color: "#3d2000" }}>
            total dirt excavated: {fmt(state.totalDirt)}
          </div>
        </div>

        {/* ── RIGHT: SHOP ── */}
        <div
          style={{
            width: 300,
            background: "#0d0700",
            borderLeft: "1px solid #3d2400",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Upgrades section */}
          {availableUpgrades.length > 0 && (
            <div
              style={{
                borderBottom: "1px solid #3d2400",
                padding: 12,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#5a3c10",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Upgrades
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {availableUpgrades.map((u) => {
                  const canAfford = state.dirt >= u.cost;
                  return (
                    <button
                      key={u.id}
                      onClick={() => dispatch({ type: "BUY_UPGRADE", id: u.id })}
                      disabled={!canAfford}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: canAfford ? "1px solid #8b6a30" : "1px solid #2a1a00",
                        background: canAfford ? "#1a0f00" : "#0d0700",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        opacity: canAfford ? 1 : 0.5,
                        color: "#d4a96a",
                        fontFamily: "inherit",
                        transition: "background 0.1s",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#d4a96a" }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#7a5c30" }}>{u.description}</div>
                      <div style={{ fontSize: 11, color: "#f0d060", marginTop: 2 }}>
                        🪙 {fmt(u.cost)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Worm shop */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: "#5a3c10",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Recruit Worms
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {WORMS.map((worm) => {
                const count = state.wormCounts[worm.id] ?? 0;
                const cost = wormCost(worm.baseCost, count);
                const canAfford = state.dirt >= cost;
                // Hide until player has earned at least half the base cost
                if (count === 0 && state.totalDirt < worm.baseCost * 0.5) return null;

                return (
                  <button
                    key={worm.id}
                    onClick={() => dispatch({ type: "BUY_WORM", id: worm.id })}
                    disabled={!canAfford}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: canAfford ? "1px solid #8b6a30" : "1px solid #2a1a00",
                      background: canAfford ? "#1a0f00" : "#0d0700",
                      cursor: canAfford ? "pointer" : "not-allowed",
                      opacity: canAfford ? 1 : 0.6,
                      color: "#d4a96a",
                      fontFamily: "inherit",
                      transition: "background 0.1s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{worm.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#d4a96a" }}>
                            {worm.name}
                          </div>
                          <div style={{ fontSize: 10, color: "#5a3c10" }}>
                            {worm.baseDPS}/s each
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0d060" }}>
                          {fmt(cost)}
                        </div>
                        {count > 0 && (
                          <div style={{ fontSize: 11, color: "#a07040" }}>×{count}</div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#5a3c10",
                        fontStyle: "italic",
                        marginTop: 4,
                      }}
                    >
                      {worm.flavor}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div
        style={{
          background: "#0d0700",
          borderTop: "1px solid #3d2400",
          padding: "6px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "#3d2000",
          flexShrink: 0,
        }}
      >
        <span>worms are eternal</span>
        <button
          onClick={handleReset}
          style={{
            background: "none",
            border: "none",
            color: "#3d2000",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#7a3030")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#3d2000")}
        >
          reset empire
        </button>
      </div>
    </div>
  );
}
