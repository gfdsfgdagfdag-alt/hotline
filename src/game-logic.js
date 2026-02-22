export const LEVEL = {
  width: 960,
  height: 540,
  walls: [
    { x: 240, y: 130, w: 480, h: 18 },
    { x: 240, y: 390, w: 480, h: 18 },
    { x: 120, y: 220, w: 18, h: 120 },
    { x: 822, y: 220, w: 18, h: 120 },
    { x: 445, y: 220, w: 70, h: 100 }
  ],
  exit: { x: 890, y: 250, w: 40, h: 40 }
};

export function createInitialState() {
  const enemies = [
    { x: 200, y: 80, hp: 2, alive: true, coolDown: 0, facing: 0 },
    { x: 760, y: 80, hp: 2, alive: true, coolDown: 0, facing: 0 },
    { x: 760, y: 460, hp: 2, alive: true, coolDown: 0, facing: 0 },
    { x: 200, y: 460, hp: 2, alive: true, coolDown: 0, facing: 0 },
    { x: 480, y: 60, hp: 3, alive: true, coolDown: 0, facing: 0 },
    { x: 480, y: 480, hp: 3, alive: true, coolDown: 0, facing: 0 }
  ];

  return {
    player: { x: 90, y: 270, hp: 5, speed: 170, fireTimer: 0, radius: 10, won: false, dead: false, facing: 0 },
    enemies,
    bullets: [],
    enemyBullets: [],
    blood: [],
    message: "Clear the floor."
  };
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function intersectsAABB(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function insideExit(player) {
  return intersectsAABB(
    { x: player.x - player.radius, y: player.y - player.radius, w: player.radius * 2, h: player.radius * 2 },
    LEVEL.exit
  );
}

function circleWallCollision(entity, nx, ny) {
  const probe = { x: nx - entity.radius, y: ny - entity.radius, w: entity.radius * 2, h: entity.radius * 2 };
  for (const wall of LEVEL.walls) {
    if (intersectsAABB(probe, wall)) return true;
  }
  return false;
}

function spawnBlood(state, x, y, amount) {
  for (let i = 0; i < amount; i += 1) {
    const a = (Math.PI * 2 * i) / amount;
    const dist = 4 + (i % 3) * 3;
    state.blood.push({ x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, size: 2 + (i % 2), ttl: 15 });
  }
}

export function movePlayer(state, input, dt) {
  const p = state.player;
  if (p.dead || p.won) return;

  p.facing = Math.atan2(input.aimY - p.y, input.aimX - p.x);

  const mag = Math.hypot(input.moveX, input.moveY) || 1;
  const vx = (input.moveX / mag) * p.speed;
  const vy = (input.moveY / mag) * p.speed;

  const nx = clamp(p.x + vx * dt, p.radius, LEVEL.width - p.radius);
  const ny = clamp(p.y + vy * dt, p.radius, LEVEL.height - p.radius);

  if (!circleWallCollision(p, nx, p.y)) p.x = nx;
  if (!circleWallCollision(p, p.x, ny)) p.y = ny;
}

export function stepBullets(bullets, dt) {
  for (const b of bullets) {
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 0 || b.y < 0 || b.x > LEVEL.width || b.y > LEVEL.height) b.active = false;
    for (const wall of LEVEL.walls) {
      if (intersectsAABB({ x: b.x - 2, y: b.y - 2, w: 4, h: 4 }, wall)) {
        b.active = false;
        break;
      }
    }
  }
}

export function resolveCombat(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    if (!b.active) continue;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < 13) {
        b.active = false;
        e.hp -= 1;
        spawnBlood(state, b.x, b.y, e.hp <= 0 ? 11 : 4);
        if (e.hp <= 0) e.alive = false;
        break;
      }
    }
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.coolDown -= dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.facing = Math.atan2(dy, dx);
    if (dist < 240 && e.coolDown <= 0) {
      const inv = 1 / (dist || 1);
      state.enemyBullets.push({ x: e.x, y: e.y, vx: dx * inv * 210, vy: dy * inv * 210, active: true });
      e.coolDown = 0.8;
    }
  }

  for (const b of state.enemyBullets) {
    if (!b.active || p.dead) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < p.radius + 2) {
      b.active = false;
      p.hp -= 1;
      spawnBlood(state, p.x, p.y, 6);
      if (p.hp <= 0) {
        p.dead = true;
        spawnBlood(state, p.x, p.y, 14);
        state.message = "You died. Press R to restart.";
      }
    }
  }

  for (const splat of state.blood) splat.ttl -= dt;
}

export function compactArrays(state) {
  if (state.bullets.length > 200) state.bullets = state.bullets.filter((b) => b.active);
  if (state.enemyBullets.length > 300) state.enemyBullets = state.enemyBullets.filter((b) => b.active);
  if (state.blood.length > 400) state.blood = state.blood.filter((b) => b.ttl > 0);
}

export function checkWin(state) {
  const allDead = state.enemies.every((e) => !e.alive);
  if (allDead && insideExit(state.player) && !state.player.dead) {
    state.player.won = true;
    state.message = "Level clear. Neon reigns.";
  } else if (allDead) {
    state.message = "Go to the glowing exit.";
  }
}
