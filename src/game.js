import {
  LEVEL,
  createInitialState,
  movePlayer,
  stepBullets,
  resolveCombat,
  compactArrays,
  checkWin
} from "./game-logic.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
const statusEl = document.getElementById("status");

let state = createInitialState();
const input = { moveX: 0, moveY: 0, shoot: false, aimX: 0, aimY: 0 };

const keyState = new Set();
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") state = createInitialState();
  keyState.add(e.key.toLowerCase());
});
document.addEventListener("keyup", (e) => keyState.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", () => (input.shoot = true));
window.addEventListener("mouseup", () => (input.shoot = false));
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  input.aimX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  input.aimY = ((e.clientY - rect.top) / rect.height) * canvas.height;
});

function updateInputAxes() {
  input.moveX = (keyState.has("d") ? 1 : 0) - (keyState.has("a") ? 1 : 0);
  input.moveY = (keyState.has("s") ? 1 : 0) - (keyState.has("w") ? 1 : 0);
}

function shoot(dt) {
  const p = state.player;
  p.fireTimer -= dt;
  if (!input.shoot || p.fireTimer > 0 || p.dead || p.won) return;

  const dx = input.aimX - p.x;
  const dy = input.aimY - p.y;
  const m = Math.hypot(dx, dy) || 1;
  const speed = 390;
  state.bullets.push({ x: p.x, y: p.y, vx: (dx / m) * speed, vy: (dy / m) * speed, active: true });
  p.fireTimer = 0.14;
}

function makeSprite(palette, rows, pixel = 2) {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement("canvas");
  c.width = w * pixel;
  c.height = h * pixel;
  const g = c.getContext("2d", { alpha: true });
  g.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y += 1) {
    const row = rows[y];
    for (let x = 0; x < w; x += 1) {
      const k = row[x];
      if (k === ".") continue;
      g.fillStyle = palette[k];
      g.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
  }

  return c;
}

const SPRITES = {
  player: makeSprite(
    {
      a: "#20142e", // outline
      b: "#f7ff32", // jacket
      c: "#e4ef21", // highlight
      d: "#f4d7b2", // skin
      e: "#d7bea1", // skin shade
      f: "#ece9ff", // legs
      g: "#ffffff", // shoes
      h: "#77748f" // gun
    },
    [
      "................",
      "......aa........",
      ".....adda.......",
      "....adddda......",
      "...aabccbaa.....",
      "..aabbccbbaa....",
      "..abbbbbbbbha...",
      "..abbbbbbbhha...",
      "..aabbbbbbaa....",
      "...afffffa......",
      "..affggfffa.....",
      "..affggfffa.....",
      "...aaaaaaaa.....",
      "................",
      "................",
      "................"
    ]
  ),
  enemy: makeSprite(
    {
      a: "#261329",
      b: "#ff2ea6",
      c: "#ff58bc",
      d: "#f3d1ae",
      e: "#d8b392",
      f: "#eadcf6",
      g: "#ffffff",
      h: "#8f8fa6"
    },
    [
      "................",
      "......aa........",
      ".....adda.......",
      "....adddda......",
      "...aabccbaa.....",
      "..aabbccbbaa....",
      "..abbbbbbbbha...",
      "..abbbbbbbhha...",
      "..aabbbbbbaa....",
      "...afffffa......",
      "..affggfffa.....",
      "..affggfffa.....",
      "...aaaaaaaa.....",
      "................",
      "................",
      "................"
    ]
  ),
  dead: makeSprite(
    {
      a: "#251920",
      b: "#5f4d56",
      c: "#7d6671",
      d: "#9d8574",
      e: "#7f6a5a",
      f: "#695968",
      g: "#867887",
      h: "#453f46"
    },
    [
      "................",
      "....aaaaaaaa....",
      "...abbbccbbba...",
      "..abccdddccba...",
      "..abccdddcbba...",
      "..abbbbbbbbha...",
      "..aabbbbbbha....",
      "...abbbbbba.....",
      "...affffffa.....",
      "..afffggfffa....",
      "..aaffggffaa....",
      "...aaaaaaaa.....",
      "................",
      "................",
      "................",
      "................"
    ]
  )
};

function drawCharacter(x, y, facing, team, dead = false) {
  const sprite = dead ? SPRITES.dead : team === "player" ? SPRITES.player : SPRITES.enemy;
  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.rotate(facing);
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  ctx.restore();
}

function drawFloor() {
  const tile = 24;
  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      const n = ((x / tile + y / tile) | 0) % 2;
      ctx.fillStyle = n === 0 ? "#2f1f3f" : "#3e2a53";
      ctx.fillRect(x, y, tile, tile);

      ctx.fillStyle = n === 0 ? "#3e2a53" : "#4d3662";
      ctx.fillRect(x + 1, y + 1, tile - 2, 2);
      ctx.fillRect(x + 1, y + tile - 3, tile - 2, 2);
    }
  }

  ctx.fillStyle = "#573678";
  for (let i = 0; i < canvas.height; i += 18) ctx.fillRect(0, i, canvas.width, 1);
}


function drawWallTexture(x, y, w, h) {
  const tile = 12;
  for (let yy = y; yy < y + h; yy += tile) {
    for (let xx = x; xx < x + w; xx += tile) {
      const alt = (((xx - x) / tile + (yy - y) / tile) | 0) % 2;
      ctx.fillStyle = alt ? "#7a35a9" : "#62298c";
      ctx.fillRect(xx, yy, Math.min(tile, x + w - xx), Math.min(tile, y + h - yy));
      ctx.fillStyle = alt ? "#8d43bd" : "#4d216e";
      ctx.fillRect(xx, yy, Math.min(tile, x + w - xx), 2);
      ctx.fillRect(xx, yy, 2, Math.min(tile, y + h - yy));
    }
  }

  ctx.fillStyle = "#2f1246";
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function drawExitTexture() {
  const { x, y, w, h } = LEVEL.exit;
  ctx.fillStyle = "#32f7ff";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#a9fcff";
  for (let i = 2; i < w; i += 6) ctx.fillRect(x + i, y + 2, 2, h - 4);
  ctx.fillStyle = "#1e8f9b";
  ctx.fillRect(x, y + h - 3, w, 3);
}

function render() {
  drawFloor();

  for (const splat of state.blood) {
    ctx.fillStyle = splat.ttl > 0 ? "#c2173f" : "#6d1128";
    ctx.fillRect((splat.x - splat.size) | 0, (splat.y - splat.size) | 0, splat.size * 2, splat.size * 2);
  }

  for (const w of LEVEL.walls) drawWallTexture(w.x, w.y, w.w, w.h);

  drawExitTexture();

  for (const e of state.enemies) drawCharacter(e.x, e.y, e.facing, "enemy", !e.alive);

  const p = state.player;
  drawCharacter(p.x, p.y, p.facing, "player", p.dead);

  ctx.fillStyle = "#ffffff";
  for (const b of state.bullets) if (b.active) ctx.fillRect(b.x - 1, b.y - 1, 3, 3);
  ctx.fillStyle = "#ff8fab";
  for (const b of state.enemyBullets) if (b.active) ctx.fillRect(b.x - 1, b.y - 1, 3, 3);

  ctx.fillStyle = "#1b0f2f";
  ctx.fillRect(6, 6, 180, 38);
  ctx.fillStyle = "#3d1f5f";
  ctx.fillRect(8, 8, 176, 4);
  ctx.fillStyle = "#32f7ff";
  ctx.fillRect(8, 42, 176, 2);

  ctx.fillStyle = "#f4eaff";
  ctx.fillText(`HP ${p.hp}`, 12, 18);
  ctx.fillText(`Enemies ${state.enemies.filter((e) => e.alive).length}`, 12, 36);
  statusEl.textContent = state.message;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updateInputAxes();
  movePlayer(state, input, dt);
  shoot(dt);
  stepBullets(state.bullets, dt);
  stepBullets(state.enemyBullets, dt);
  resolveCombat(state, dt);
  checkWin(state);
  compactArrays(state);
  render();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
