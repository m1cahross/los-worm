"use client";

import { useEffect, useRef, useState } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const WORLD      = 2500;
const SEG_DIST   = 8;       // pixels between body segment centers
const FOOD_TOTAL = 800;
const BOT_TOTAL  = 8;
const TURN_RATE  = 0.08;    // radians per frame max turn
const EAT_BONUS  = 14;      // extra pickup radius beyond worm radius

// ─── LEVEL DATA ───────────────────────────────────────────────────────────────

const LEVELS = [
  { name: "Hank",      color: "#ff7777", shadow: "#881111", radius: 8,  speed: 3.0, xpToNext: 25  },
  { name: "Larry",     color: "#ffbb55", shadow: "#885500", radius: 12, speed: 3.4, xpToNext: 65  },
  { name: "Jerry",     color: "#66ee66", shadow: "#226622", radius: 16, speed: 3.8, xpToNext: 140 },
  { name: "Gary",      color: "#8899ff", shadow: "#223399", radius: 21, speed: 4.2, xpToNext: 270 },
  { name: "Darilyn",   color: "#ee77ee", shadow: "#882288", radius: 28, speed: 4.6, xpToNext: 480 },
  { name: "MatzoBrei", color: "#ffd700", shadow: "#886600", radius: 38, speed: 5.0, xpToNext: Infinity },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Pt     = { x: number; y: number };
type Phase  = "start" | "playing" | "dead" | "won";

type Player = { segs: Pt[]; angle: number; xp: number; level: number };
type Bot    = { id: number; name: string; segs: Pt[]; angle: number; turnTimer: number; levelIdx: number; color: string; shadow: string };
type Food   = { id: number; x: number; y: number; color: string };

type GS = {
  player:       Player;
  bots:         Bot[];
  foods:        Food[];
  mouse:        Pt;
  phase:        Phase;
  lvlMsgText:   string | null;
  lvlMsgTimer:  number;
  animId:       number;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

let _fid = 0, _bid = 0;
const FOOD_COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6fc8","#c77dff","#ff9f43","#00e5ff"];
const BOT_COLORS  = ["#ff9955","#55ddaa","#aa77ff","#ff7799","#77ccff","#ffdd55","#ff77aa","#aaffcc"];
const BOT_SHADOWS = ["#995522","#228866","#553388","#993344","#336688","#886600","#994466","#557744"];
const BOT_NAMES   = [
  "Mordechai","Mordy","Chaya","Charilyn","FoBrøyna","Avshalom",
  "Fitzwilliam","Larilyn","Spank","Heinrich","Harilyn","Bubbie",
  "DarryQueen","HennyBalooga","Linny",
];
let _nameIdx = 0;
function nextBotName() {
  const name = BOT_NAMES[_nameIdx % BOT_NAMES.length];
  _nameIdx++;
  return name;
}

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function makeFood(): Food {
  return {
    id: _fid++,
    x: rnd(60, WORLD - 60),
    y: rnd(60, WORLD - 60),
    color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
  };
}

function makeSegs(x: number, y: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x, y: y + i * SEG_DIST }));
}

function makeBot(): Bot {
  const li = Math.floor(Math.random() * 4); // bots max at Gary
  const ci = Math.floor(Math.random() * BOT_COLORS.length);
  return {
    id: _bid++,
    name: nextBotName(),
    segs: makeSegs(rnd(150, WORLD - 150), rnd(150, WORLD - 150), 20 + li * 8),
    angle: Math.random() * Math.PI * 2,
    turnTimer: Math.floor(rnd(80, 200)),
    levelIdx: li,
    color: BOT_COLORS[ci],
    shadow: BOT_SHADOWS[ci],
  };
}

function followSegs(segs: Pt[]) {
  for (let i = 1; i < segs.length; i++) {
    const p = segs[i - 1], c = segs[i];
    const dx = p.x - c.x, dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > SEG_DIST) {
      c.x += (dx / d) * (d - SEG_DIST);
      c.y += (dy / d) * (d - SEG_DIST);
    }
  }
}

function clampWorld(p: Pt, m = 40) {
  p.x = Math.max(m, Math.min(WORLD - m, p.x));
  p.y = Math.max(m, Math.min(WORLD - m, p.y));
}

function shortAngle(a: number, b: number) {
  let d = b - a;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function Game() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const gsRef      = useRef<GS | null>(null);
  const [phase,      setPhase]      = useState<Phase>("start");
  const [deathLevel, setDeathLevel] = useState(0);

  function initGame() {
    const cx = WORLD / 2, cy = WORLD / 2;
    const iw = typeof window !== "undefined" ? window.innerWidth  : 800;
    const ih = typeof window !== "undefined" ? window.innerHeight : 600;
    gsRef.current = {
      player:      { segs: makeSegs(cx, cy, 20), angle: -Math.PI / 2, xp: 0, level: 0 },
      bots:        Array.from({ length: BOT_TOTAL  }, makeBot),
      foods:       Array.from({ length: FOOD_TOTAL }, makeFood),
      mouse:       { x: iw / 2, y: ih / 2 },
      phase:       "playing",
      lvlMsgText:  null,
      lvlMsgTimer: 0,
      animId:      0,
    };
  }

  function startGame() {
    initGame();
    setDeathLevel(0);
    setPhase("playing");
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function onMouseMove(e: MouseEvent) {
      if (gsRef.current) gsRef.current.mouse = { x: e.clientX, y: e.clientY };
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (gsRef.current && e.touches[0])
        gsRef.current.mouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    const ctx = canvas.getContext("2d")!;
    const gs  = gsRef.current!;

    // ── DRAW WORM ──────────────────────────────────────────────────────────────
    function drawWorm(segs: Pt[], lvlIdx: number, color: string, shadow: string, camX: number, camY: number, name?: string) {
      if (!segs.length) return;
      const W = canvas!.width, H = canvas!.height;
      const radius = LEVELS[Math.min(lvlIdx, LEVELS.length - 1)].radius;

      // Body (tail → head so head is drawn on top)
      for (let i = segs.length - 1; i >= 0; i--) {
        const sx = segs[i].x - camX;
        const sy = segs[i].y - camY;
        if (sx < -radius * 3 || sx > W + radius * 3 || sy < -radius * 3 || sy > H + radius * 3) continue;

        const taper = 0.65 + 0.35 * (1 - (i / segs.length) * 0.55);
        const r = radius * taper;

        ctx.beginPath();
        ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = shadow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Eyes
      const head = segs[0];
      const hx = head.x - camX;
      const hy = head.y - camY;
      const hAngle = segs.length > 1
        ? Math.atan2(head.y - segs[1].y, head.x - segs[1].x)
        : 0;
      const eyeOff = radius * 0.45;
      const eyeR   = Math.max(2.5, radius * 0.28);

      for (const side of [-0.55, 0.55]) {
        const ex = hx + Math.cos(hAngle + side) * eyeOff;
        const ey = hy + Math.sin(hAngle + side) * eyeOff;
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fillStyle = "white"; ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + Math.cos(hAngle) * eyeR * 0.35, ey + Math.sin(hAngle) * eyeR * 0.35, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = "#111"; ctx.fill();
      }

      // Nametag
      if (name) {
        const tagY    = hy - radius - 8;
        const fontSize = Math.max(10, Math.min(13, radius * 0.65));
        ctx.font      = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.textAlign = "center";
        const tw = ctx.measureText(name).width;
        ctx.fillStyle = "#000000cc";
        ctx.fillRect(hx - tw / 2 - 4, tagY - fontSize, tw + 8, fontSize + 4);
        ctx.fillStyle = color;
        ctx.fillText(name, hx, tagY);
        ctx.textAlign = "left";
      }
    }

    // ── GAME LOOP ──────────────────────────────────────────────────────────────
    function loop() {
      const g = gsRef.current;
      if (!g || g.phase !== "playing") return;

      const W = canvas!.width, H = canvas!.height;
      const { player, bots, foods } = g;
      const lvl  = LEVELS[player.level];
      const head = player.segs[0];

      // Move player toward mouse
      const tAngle = Math.atan2(g.mouse.y - H / 2, g.mouse.x - W / 2);
      const diff   = shortAngle(player.angle, tAngle);
      player.angle += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE);
      head.x += Math.cos(player.angle) * lvl.speed;
      head.y += Math.sin(player.angle) * lvl.speed;
      clampWorld(head);
      followSegs(player.segs);

      // Move bots
      for (const bot of bots) {
        const bh = bot.segs[0];
        // Bounce off walls
        if      (bh.x < 120)          bot.angle = rnd(-0.3, 0.3);
        else if (bh.x > WORLD - 120)  bot.angle = Math.PI + rnd(-0.3, 0.3);
        else if (bh.y < 120)          bot.angle = Math.PI / 2 + rnd(-0.3, 0.3);
        else if (bh.y > WORLD - 120)  bot.angle = -Math.PI / 2 + rnd(-0.3, 0.3);
        else {
          bot.turnTimer--;
          if (bot.turnTimer <= 0) {
            bot.angle    += rnd(-1.2, 1.2);
            bot.turnTimer = Math.floor(rnd(60, 180));
          }
        }
        const bs = LEVELS[bot.levelIdx].speed * 0.8;
        bh.x += Math.cos(bot.angle) * bs;
        bh.y += Math.sin(bot.angle) * bs;
        clampWorld(bh);
        followSegs(bot.segs);
      }

      // Eat food
      const eatR = lvl.radius + EAT_BONUS;
      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        if (Math.hypot(head.x - f.x, head.y - f.y) < eatR) {
          foods[i] = makeFood(); // respawn in place

          // Grow tail
          const tail = player.segs[player.segs.length - 1];
          player.segs.push({ x: tail.x, y: tail.y });
          player.xp++;

          // Check level up
          const xpNeeded = LEVELS[player.level].xpToNext;
          if (xpNeeded !== Infinity && player.xp >= xpNeeded && player.level < LEVELS.length - 1) {
            player.level++;
            player.xp = 0;
            // Bonus length on evolve
            for (let j = 0; j < 20; j++) {
              const t2 = player.segs[player.segs.length - 1];
              player.segs.push({ x: t2.x, y: t2.y });
            }
            const newName = LEVELS[player.level].name;
            g.lvlMsgText  = player.level === LEVELS.length - 1
              ? `YOU ARE ${newName.toUpperCase()}!`
              : `You are now ${newName}!`;
            g.lvlMsgTimer = 180;
            if (player.level === LEVELS.length - 1) {
              g.phase = "won";
              setPhase("won");
              return;
            }
          }
        }
      }

      // Collision: player head hits bot body → player dies
      outer:
      for (const bot of bots) {
        const br      = LEVELS[bot.levelIdx].radius;
        const killDist = lvl.radius + br - 6;
        for (let i = 3; i < bot.segs.length; i++) {
          if (Math.hypot(head.x - bot.segs[i].x, head.y - bot.segs[i].y) < killDist) {
            g.phase = "dead";
            setDeathLevel(player.level);
            setPhase("dead");
            break outer;
          }
        }
      }
      if (g.phase !== "playing") return;

      // Collision: bot head hits player body → bot dies, explodes into pellets
      for (let bi = bots.length - 1; bi >= 0; bi--) {
        const bot  = bots[bi];
        const bh   = bot.segs[0];
        const br   = LEVELS[bot.levelIdx].radius;
        const killDist = br + lvl.radius - 6;
        let killed = false;
        for (let pi = 5; pi < player.segs.length; pi++) {
          if (Math.hypot(bh.x - player.segs[pi].x, bh.y - player.segs[pi].y) < killDist) {
            killed = true;
            break;
          }
        }
        if (killed) {
          // Explode the bot into food pellets (every 3rd segment + a few extras)
          for (let si = 0; si < bot.segs.length; si += 3) {
            foods.push({
              id: _fid++,
              x: bot.segs[si].x + rnd(-6, 6),
              y: bot.segs[si].y + rnd(-6, 6),
              color: bot.color,
            });
          }
          // Bonus dense cluster at head
          for (let k = 0; k < 5; k++) {
            foods.push({ id: _fid++, x: bh.x + rnd(-12, 12), y: bh.y + rnd(-12, 12), color: bot.color });
          }
          // Respawn bot at new location
          bots[bi] = makeBot();
        }
      }

      // Level-up message countdown
      if (g.lvlMsgTimer > 0) {
        g.lvlMsgTimer--;
      } else {
        g.lvlMsgText = null;
      }

      // ── RENDER ──────────────────────────────────────────────────────────────

      const camX = head.x - W / 2;
      const camY = head.y - H / 2;

      // Background
      ctx.fillStyle = "#0c1a08";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "#162610";
      ctx.lineWidth   = 1;
      const G   = 80;
      const ox  = ((G - camX % G) % G);
      const oy  = ((G - camY % G) % G);
      for (let gx = ox; gx < W; gx += G) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = oy; gy < H; gy += G) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // World border
      ctx.strokeStyle = "#3a7a22";
      ctx.lineWidth   = 5;
      ctx.strokeRect(-camX, -camY, WORLD, WORLD);

      // Food
      for (const f of foods) {
        const fx = f.x - camX, fy = f.y - camY;
        if (fx < -20 || fx > W + 20 || fy < -20 || fy > H + 20) continue;
        ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2);
        ctx.fillStyle = f.color + "44"; ctx.fill();
        ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fillStyle = f.color; ctx.fill();
      }

      // Bots
      for (const bot of bots) drawWorm(bot.segs, bot.levelIdx, bot.color, bot.shadow, camX, camY, bot.name);

      // Player
      drawWorm(player.segs, player.level, lvl.color, lvl.shadow, camX, camY);

      // ── HUD ─────────────────────────────────────────────────────────────────

      const bx = 20, by = 26;
      const barW = 200, barH = 16;
      const xpNeeded = LEVELS[player.level].xpToNext;
      const xpPct    = xpNeeded === Infinity ? 1 : Math.min(player.xp / xpNeeded, 1);

      // Background panel
      ctx.fillStyle = "#00000099";
      ctx.fillRect(bx - 10, by - 28, barW + 20, 78);

      // Worm name
      ctx.font      = "bold 17px 'Courier New', monospace";
      ctx.fillStyle = lvl.color;
      ctx.textAlign = "left";
      ctx.fillText(lvl.name, bx, by);

      // XP bar track
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(bx, by + 6, barW, barH);
      // XP bar fill
      ctx.fillStyle = lvl.color;
      ctx.fillRect(bx, by + 6, barW * xpPct, barH);
      // XP bar border
      ctx.strokeStyle = "#555";
      ctx.lineWidth   = 1;
      ctx.strokeRect(bx, by + 6, barW, barH);
      // XP text
      ctx.font      = "10px 'Courier New', monospace";
      ctx.fillStyle = "#ffffffbb";
      ctx.fillText(xpNeeded === Infinity ? "MAX" : `${player.xp} / ${xpNeeded}`, bx + 5, by + 18);

      // Level progression dots
      const dotY    = by + 38;
      const dotGap  = barW / (LEVELS.length - 1);
      for (let i = 0; i < LEVELS.length; i++) {
        const dx = bx + i * dotGap;
        const isActive  = i === player.level;
        const isPast    = i < player.level;
        ctx.beginPath();
        ctx.arc(dx, dotY, isActive ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = (isActive || isPast) ? LEVELS[i].color : "#2a2a2a";
        ctx.fill();
        if (isActive) {
          ctx.strokeStyle = LEVELS[i].color;
          ctx.lineWidth   = 2;
          ctx.stroke();
        }
      }

      // Length counter (top right)
      ctx.font      = "12px 'Courier New', monospace";
      ctx.fillStyle = "#ffffff44";
      ctx.textAlign = "right";
      ctx.fillText(`length ${player.segs.length}`, W - 16, 28);
      ctx.textAlign = "left";

      // Level-up message
      if (g.lvlMsgText && g.lvlMsgTimer > 0) {
        const t     = g.lvlMsgTimer / 180;
        const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
        ctx.globalAlpha = alpha;
        ctx.font        = "bold 44px 'Courier New', monospace";
        ctx.textAlign   = "center";
        ctx.fillStyle   = LEVELS[player.level].color;
        ctx.fillText(g.lvlMsgText, W / 2, H / 2 - 10);
        ctx.font      = "20px 'Courier New', monospace";
        ctx.fillStyle = "#ffffffcc";
        ctx.fillText("you evolved!", W / 2, H / 2 + 28);
        ctx.globalAlpha = 1;
        ctx.textAlign   = "left";
      }

      g.animId = requestAnimationFrame(loop);
    }

    gs.animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(gs.animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [phase]);

  // ─── STYLES ─────────────────────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "#0c1a08ee", gap: 18, textAlign: "center", padding: 24,
    fontFamily: "'Courier New', monospace",
  };

  function btn(bg: string, fg: string): React.CSSProperties {
    return { padding: "12px 40px", fontSize: 18, fontWeight: 700, background: bg, color: fg, border: "none", borderRadius: 30, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2, marginTop: 8 };
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0c1a08", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: phase === "playing" ? "block" : "none" }} />

      {/* START */}
      {phase === "start" && (
        <div style={overlay}>
          <h1 style={{ fontSize: 64, fontWeight: 900, color: "#ffd700", margin: 0, letterSpacing: 6, textShadow: "0 0 30px #ffaa00" }}>
            LOS WORM
          </h1>
          <p style={{ color: "#88ee88", fontSize: 16, margin: 0 }}>Eat. Grow. Evolve.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, margin: "6px 0" }}>
            {LEVELS.map((l, i) => (
              <div key={l.name} style={{ color: l.color, fontSize: 15 }}>
                {i === LEVELS.length - 1 ? "★" : "›"} {l.name}
                {i === LEVELS.length - 1 ? " — final form" : ""}
              </div>
            ))}
          </div>
          <p style={{ color: "#555", fontSize: 13, maxWidth: 360 }}>
            Move your mouse to steer. Eat the glowing pellets to grow and evolve.
            Avoid hitting other worms.
          </p>
          <button onClick={startGame} style={btn("#ffd700", "#000")}>PLAY</button>
        </div>
      )}

      {/* DEAD */}
      {phase === "dead" && (
        <div style={overlay}>
          <h1 style={{ fontSize: 56, fontWeight: 900, color: "#ff4444", margin: 0, textShadow: "0 0 20px #ff0000" }}>
            YOU DIED
          </h1>
          <p style={{ color: "#aaa", fontSize: 17 }}>
            You were{" "}
            <span style={{ color: LEVELS[deathLevel].color, fontWeight: 700 }}>
              {LEVELS[deathLevel].name}
            </span>.
          </p>
          <p style={{ color: "#555", fontSize: 13 }}>You collided with another worm.</p>
          <button onClick={startGame} style={btn("#ff4444", "#fff")}>TRY AGAIN</button>
        </div>
      )}

      {/* WON */}
      {phase === "won" && (
        <div style={overlay}>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#ffd700", margin: 0, textShadow: "0 0 40px #ffaa00", lineHeight: 1.1 }}>
            YOU ARE<br />MATZOBREI
          </h1>
          <p style={{ color: "#ffd700", fontSize: 18 }}>The earth itself trembles.</p>
          <p style={{ color: "#666", fontSize: 13 }}>The worm empire is complete.</p>
          <button onClick={startGame} style={btn("#ffd700", "#000")}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}
