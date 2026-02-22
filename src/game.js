import {
  WEAPONS,
  LEVELS,
  createInitialState,
  movePlayer,
  playerShoot,
  pickupWeapon,
  throwWeapon,
  updateEnemies,
  stepProjectiles,
  resolveCombat,
  checkProgress,
  compactArrays
} from "./game-logic.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
const statusEl = document.getElementById("status");

let state = createInitialState(0);
const input = { moveX: 0, moveY: 0, shoot: false, aimX: canvas.width * 0.5, aimY: canvas.height * 0.5 };
canvas.tabIndex = 0;

const keyState = new Set();
const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

function updateInputAxes() {
  const right = keyState.has("KeyD") || keyState.has("ArrowRight");
  const left = keyState.has("KeyA") || keyState.has("ArrowLeft");
  const down = keyState.has("KeyS") || keyState.has("ArrowDown");
  const up = keyState.has("KeyW") || keyState.has("ArrowUp");
  input.moveX = (right ? 1 : 0) - (left ? 1 : 0);
  input.moveY = (down ? 1 : 0) - (up ? 1 : 0);
}

window.addEventListener("keydown", (e) => {
  if (MOVEMENT_KEYS.has(e.code)) e.preventDefault();
  keyState.add(e.code);
  if (e.code === "KeyR") state = createInitialState(state.levelIndex);
  if (e.code === "KeyE") pickupWeapon(state);
  if (e.code === "KeyQ") throwWeapon(state);
  if (e.code === "KeyN" && state.player.won && !state.gameCompleted) state = createInitialState(Math.min(state.levelIndex + 1, LEVELS.length - 1));
});
window.addEventListener("keyup", (e) => keyState.delete(e.code));
window.addEventListener("blur", () => keyState.clear());
canvas.addEventListener("mousedown", () => { input.shoot = true; canvas.focus(); });
window.addEventListener("mouseup", () => (input.shoot = false));
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  input.aimX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  input.aimY = ((e.clientY - rect.top) / rect.height) * canvas.height;
});

function makeSprite(palette, rows, pixel = 2) {
  const c = document.createElement("canvas");
  c.width = rows[0].length * pixel;
  c.height = rows.length * pixel;
  const g = c.getContext("2d", { alpha: true });
  g.imageSmoothingEnabled = false;
  rows.forEach((row, y) => [...row].forEach((k, x) => {
    if (k === ".") return;
    g.fillStyle = palette[k];
    g.fillRect(x * pixel, y * pixel, pixel, pixel);
  }));
  return c;
}

const SPRITES = {
  player: makeSprite({ a: "#20142e", b: "#f7ff32", c: "#e4ef21", d: "#f4d7b2", f: "#ece9ff", g: "#ffffff", h: "#77748f" }, [
    "................","......aa........",".....adda.......","....adddda......","...aabccbaa.....","..aabbccbbaa....","..abbbbbbbbha...","..abbbbbbbhha...","..aabbbbbbaa....","...afffffa......","..affggfffa.....","..affggfffa.....","...aaaaaaaa.....","................","................","................"
  ]),
  enemy: makeSprite({ a: "#261329", b: "#ff2ea6", c: "#ff58bc", d: "#f3d1ae", f: "#eadcf6", g: "#ffffff", h: "#8f8fa6" }, [
    "................","......aa........",".....adda.......","....adddda......","...aabccbaa.....","..aabbccbbaa....","..abbbbbbbbha...","..abbbbbbbhha...","..aabbbbbbaa....","...afffffa......","..affggfffa.....","..affggfffa.....","...aaaaaaaa.....","................","................","................"
  ]),
  dead: makeSprite({ a: "#251920", b: "#5f4d56", c: "#7d6671", d: "#9d8574", f: "#695968", g: "#867887", h: "#453f46" }, [
    "................","....aaaaaaaa....","...abbbccbbba...","..abccdddccba...","..abccdddcbba...","..abbbbbbbbha...","..aabbbbbbha....","...abbbbbba.....","...affffffa.....","..afffggfffa....","..aaffggffaa....","...aaaaaaaa.....","................","................","................","................"
  ])
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
  for (let y = 0; y < canvas.height; y += 24) {
    for (let x = 0; x < canvas.width; x += 24) {
      const n = ((x / 24 + y / 24) | 0) % 2;
      ctx.fillStyle = n ? "#3e2a53" : "#2f1f3f";
      ctx.fillRect(x, y, 24, 24);
    }
  }
}

function drawWallTexture(x, y, w, h) {
  for (let yy = y; yy < y + h; yy += 12) {
    for (let xx = x; xx < x + w; xx += 12) {
      const alt = (((xx - x) / 12 + (yy - y) / 12) | 0) % 2;
      ctx.fillStyle = alt ? "#7a35a9" : "#62298c";
      ctx.fillRect(xx, yy, Math.min(12, x + w - xx), Math.min(12, y + h - yy));
    }
  }
  ctx.fillStyle = "#2f1246";
  ctx.fillRect(x, y, w, 2);
}

function render() {
  drawFloor();
  for (const splat of state.blood) {
    ctx.fillStyle = splat.ttl > 0 ? "#c2173f" : "#6d1128";
    ctx.fillRect((splat.x - splat.size) | 0, (splat.y - splat.size) | 0, splat.size * 2, splat.size * 2);
  }

  for (const w of state.level.walls) drawWallTexture(w.x, w.y, w.w, w.h);
  ctx.fillStyle = "#32f7ff";
  ctx.fillRect(state.level.exit.x, state.level.exit.y, state.level.exit.w, state.level.exit.h);

  for (const item of state.pickups) {
    ctx.fillStyle = item.type === "shotgun" ? "#ff9de8" : item.type === "smg" ? "#ffe49e" : "#d4d4d4";
    ctx.fillRect(item.x - 6, item.y - 3, 12, 6);
    ctx.fillStyle = "#222";
    ctx.fillRect(item.x - 8, item.y - 1, 4, 2);
  }

  for (const e of state.enemies) drawCharacter(e.x, e.y, e.facing, "enemy", !e.alive);
  drawCharacter(state.player.x, state.player.y, state.player.facing, "player", state.player.dead);

  for (const tw of state.thrownWeapons) {
    if (!tw.active) continue;
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(tw.x - 5, tw.y - 2, 10, 4);
  }

  for (const b of state.bullets) if (b.active) { ctx.fillStyle = b.color || "#fff"; ctx.fillRect(b.x - 1, b.y - 1, 3, 3); }
  for (const b of state.enemyBullets) if (b.active) { ctx.fillStyle = "#ff8fab"; ctx.fillRect(b.x - 1, b.y - 1, 3, 3); }

  ctx.fillStyle = "#1b0f2f";
  ctx.fillRect(6, 6, 370, 52);
  ctx.fillStyle = "#f4eaff";
  ctx.fillText(`HP ${state.player.hp}`, 12, 20);
  ctx.fillText(`Level ${state.levelIndex + 1}/${LEVELS.length}`, 12, 36);
  ctx.fillText(`Weapon ${state.player.weapon.type.toUpperCase()} (${state.player.weapon.ammo})`, 120, 20);
  ctx.fillText(`Enemies ${state.enemies.filter((e) => e.alive).length}`, 120, 36);

  statusEl.textContent = `${state.message} Controls: E pickup · Q throw · N next level`;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  updateInputAxes();
  movePlayer(state, input, dt);
  if (input.shoot) playerShoot(state, input.aimX, input.aimY);
  updateEnemies(state, dt);
  stepProjectiles(state, dt);
  resolveCombat(state, dt);
  checkProgress(state);
  compactArrays(state);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
