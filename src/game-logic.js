export const WEAPONS = {
  pistol: { fireRate: 0.18, bulletSpeed: 390, damage: 1, spread: 0.04, pellets: 1, maxAmmo: 999, color: "#ffffff" },
  smg: { fireRate: 0.08, bulletSpeed: 420, damage: 1, spread: 0.1, pellets: 1, maxAmmo: 40, color: "#ffe39e" },
  shotgun: { fireRate: 0.5, bulletSpeed: 350, damage: 1, spread: 0.35, pellets: 5, maxAmmo: 20, color: "#ffd0ff" }
};

export const LEVELS = [
  {
    width: 960,
    height: 540,
    walls: [
      { x: 220, y: 120, w: 520, h: 18 },
      { x: 220, y: 402, w: 520, h: 18 },
      { x: 120, y: 210, w: 18, h: 130 },
      { x: 822, y: 210, w: 18, h: 130 },
      { x: 448, y: 220, w: 64, h: 100 }
    ],
    exit: { x: 892, y: 248, w: 40, h: 40 },
    playerSpawn: { x: 90, y: 270 },
    pickups: [{ x: 300, y: 270, type: "smg", ammo: 30 }],
    enemies: [
      { x: 190, y: 90, hp: 2, patrol: [{ x: 190, y: 90 }, { x: 190, y: 180 }] },
      { x: 760, y: 90, hp: 2, patrol: [{ x: 760, y: 90 }, { x: 760, y: 180 }] },
      { x: 760, y: 450, hp: 2, patrol: [{ x: 760, y: 450 }, { x: 760, y: 360 }] },
      { x: 190, y: 450, hp: 2, patrol: [{ x: 190, y: 450 }, { x: 190, y: 360 }] }
    ]
  },
  {
    width: 960,
    height: 540,
    walls: [
      { x: 180, y: 90, w: 18, h: 360 },
      { x: 762, y: 90, w: 18, h: 360 },
      { x: 300, y: 90, w: 360, h: 18 },
      { x: 300, y: 432, w: 360, h: 18 },
      { x: 420, y: 200, w: 120, h: 18 },
      { x: 420, y: 322, w: 120, h: 18 }
    ],
    exit: { x: 902, y: 60, w: 36, h: 36 },
    playerSpawn: { x: 80, y: 500 },
    pickups: [
      { x: 500, y: 260, type: "shotgun", ammo: 10 },
      { x: 260, y: 260, type: "smg", ammo: 25 }
    ],
    enemies: [
      { x: 340, y: 150, hp: 3, patrol: [{ x: 340, y: 150 }, { x: 620, y: 150 }] },
      { x: 620, y: 380, hp: 3, patrol: [{ x: 620, y: 380 }, { x: 340, y: 380 }] },
      { x: 860, y: 300, hp: 2, patrol: [{ x: 860, y: 300 }, { x: 860, y: 120 }] },
      { x: 260, y: 260, hp: 2, patrol: [{ x: 260, y: 260 }, { x: 260, y: 420 }] }
    ]
  }
];

export function createInitialState(levelIndex = 0) {
  const level = LEVELS[levelIndex];
  const enemies = level.enemies.map((e) => ({
    x: e.x,
    y: e.y,
    hp: e.hp,
    alive: true,
    coolDown: 0,
    facing: 0,
    patrol: e.patrol,
    patrolIndex: 0,
    speed: 65
  }));

  return {
    levelIndex,
    level,
    player: {
      x: level.playerSpawn.x,
      y: level.playerSpawn.y,
      hp: 5,
      speed: 170,
      radius: 10,
      won: false,
      dead: false,
      facing: 0,
      fireTimer: 0,
      throwTimer: 0,
      weapon: { type: "pistol", ammo: 999 }
    },
    enemies,
    bullets: [],
    enemyBullets: [],
    thrownWeapons: [],
    pickups: level.pickups.map((p) => ({ ...p })),
    blood: [],
    message: `Level ${levelIndex + 1}: clear the floor.`,
    gameCompleted: false
  };
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function intersectsAABB(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleWallCollision(level, radius, nx, ny) {
  const probe = { x: nx - radius, y: ny - radius, w: radius * 2, h: radius * 2 };
  return level.walls.some((wall) => intersectsAABB(probe, wall));
}

function spawnBlood(state, x, y, amount) {
  for (let i = 0; i < amount; i += 1) {
    const a = (Math.PI * 2 * i) / amount;
    state.blood.push({ x: x + Math.cos(a) * (4 + (i % 3) * 3), y: y + Math.sin(a) * (4 + (i % 3) * 3), size: 2 + (i % 2), ttl: 15 });
  }
}

export function movePlayer(state, input, dt) {
  const p = state.player;
  if (p.dead || p.won) return;
  p.facing = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  const mag = Math.hypot(input.moveX, input.moveY) || 1;
  const vx = (input.moveX / mag) * p.speed;
  const vy = (input.moveY / mag) * p.speed;
  const nx = clamp(p.x + vx * dt, p.radius, state.level.width - p.radius);
  const ny = clamp(p.y + vy * dt, p.radius, state.level.height - p.radius);
  if (!circleWallCollision(state.level, p.radius, nx, p.y)) p.x = nx;
  if (!circleWallCollision(state.level, p.radius, p.x, ny)) p.y = ny;
}

export function playerShoot(state, aimX, aimY) {
  const p = state.player;
  const def = WEAPONS[p.weapon.type];
  if (p.dead || p.won || p.fireTimer > 0 || p.weapon.ammo <= 0) return;
  const dx = aimX - p.x;
  const dy = aimY - p.y;
  const base = Math.atan2(dy, dx);
  for (let i = 0; i < def.pellets; i += 1) {
    const spread = def.pellets === 1 ? (Math.random() - 0.5) * def.spread : ((i / (def.pellets - 1)) - 0.5) * def.spread;
    const ang = base + spread;
    state.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * def.bulletSpeed,
      vy: Math.sin(ang) * def.bulletSpeed,
      active: true,
      damage: def.damage,
      color: def.color
    });
  }
  p.weapon.ammo -= 1;
  p.fireTimer = def.fireRate;
  if (p.weapon.ammo <= 0 && p.weapon.type !== "pistol") {
    p.weapon = { type: "pistol", ammo: 999 };
    state.message = "Weapon empty, switched to pistol.";
  }
}

export function pickupWeapon(state) {
  const p = state.player;
  let pickIndex = -1;
  let best = 40;
  for (let i = 0; i < state.pickups.length; i += 1) {
    const item = state.pickups[i];
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d < best) {
      best = d;
      pickIndex = i;
    }
  }
  if (pickIndex === -1) return;
  const item = state.pickups[pickIndex];
  if (p.weapon.type !== "pistol") state.pickups.push({ x: p.x, y: p.y, type: p.weapon.type, ammo: Math.max(1, p.weapon.ammo) });
  p.weapon = { type: item.type, ammo: item.ammo };
  state.pickups.splice(pickIndex, 1);
  state.message = `Picked up ${item.type.toUpperCase()}.`;
}

export function throwWeapon(state) {
  const p = state.player;
  if (p.weapon.type === "pistol" || p.throwTimer > 0 || p.dead) return;
  const speed = 300;
  state.thrownWeapons.push({ x: p.x, y: p.y, vx: Math.cos(p.facing) * speed, vy: Math.sin(p.facing) * speed, type: p.weapon.type, active: true, ttl: 1.2 });
  p.weapon = { type: "pistol", ammo: 999 };
  p.throwTimer = 0.45;
  state.message = "Weapon thrown!";
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const target = e.patrol[e.patrolIndex];
    const tx = target.x - e.x;
    const ty = target.y - e.y;
    const tDist = Math.hypot(tx, ty);
    if (tDist < 6) e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length;
    else {
      const nx = e.x + (tx / (tDist || 1)) * e.speed * dt;
      const ny = e.y + (ty / (tDist || 1)) * e.speed * dt;
      if (!circleWallCollision(state.level, 10, nx, e.y)) e.x = nx;
      if (!circleWallCollision(state.level, 10, e.x, ny)) e.y = ny;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.facing = Math.atan2(dy, dx);
    e.coolDown -= dt;
    if (dist < 260 && e.coolDown <= 0) {
      const inv = 1 / (dist || 1);
      state.enemyBullets.push({ x: e.x, y: e.y, vx: dx * inv * 210, vy: dy * inv * 210, active: true, damage: 1, color: "#ff8fab" });
      e.coolDown = 0.9;
    }
  }
}

export function stepProjectiles(state, dt) {
  const all = [state.bullets, state.enemyBullets, state.thrownWeapons];
  for (const list of all) {
    for (const b of list) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.ttl != null) b.ttl -= dt;
      if (b.ttl != null && b.ttl <= 0) b.active = false;
      if (b.x < 0 || b.y < 0 || b.x > state.level.width || b.y > state.level.height) b.active = false;
      for (const wall of state.level.walls) {
        if (intersectsAABB({ x: b.x - 2, y: b.y - 2, w: 4, h: 4 }, wall)) { b.active = false; break; }
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
      if (Math.hypot(b.x - e.x, b.y - e.y) < 13) {
        b.active = false;
        e.hp -= b.damage || 1;
        spawnBlood(state, b.x, b.y, e.hp <= 0 ? 11 : 5);
        if (e.hp <= 0) e.alive = false;
        break;
      }
    }
  }

  for (const tw of state.thrownWeapons) {
    if (!tw.active) continue;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(tw.x - e.x, tw.y - e.y) < 16) {
        e.alive = false;
        tw.active = false;
        state.pickups.push({ x: e.x, y: e.y, type: tw.type, ammo: 4 });
        spawnBlood(state, e.x, e.y, 14);
        break;
      }
    }
    if (!tw.active) continue;
    if (tw.ttl <= 0) state.pickups.push({ x: tw.x, y: tw.y, type: tw.type, ammo: 4 });
  }

  for (const b of state.enemyBullets) {
    if (!b.active || p.dead) continue;
    if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 2) {
      b.active = false;
      p.hp -= b.damage || 1;
      spawnBlood(state, p.x, p.y, 6);
      if (p.hp <= 0) {
        p.dead = true;
        state.message = "You died. Press R to restart.";
      }
    }
  }

  p.fireTimer -= dt;
  p.throwTimer -= dt;
  for (const splat of state.blood) splat.ttl -= dt;
}

export function checkProgress(state) {
  const allDead = state.enemies.every((e) => !e.alive);
  const exitHit = intersectsAABB(
    { x: state.player.x - state.player.radius, y: state.player.y - state.player.radius, w: state.player.radius * 2, h: state.player.radius * 2 },
    state.level.exit
  );
  if (allDead && exitHit && !state.player.dead) {
    if (state.levelIndex < LEVELS.length - 1) {
      state.player.won = true;
      state.message = `Level ${state.levelIndex + 1} clear! Press N for next level.`;
      return "next";
    }
    state.gameCompleted = true;
    state.player.won = true;
    state.message = "All levels cleared. Neon legend!";
    return "done";
  }
  if (allDead) state.message = "Head to the exit.";
  return "stay";
}

export function compactArrays(state) {
  if (state.bullets.length > 200) state.bullets = state.bullets.filter((b) => b.active);
  if (state.enemyBullets.length > 300) state.enemyBullets = state.enemyBullets.filter((b) => b.active);
  if (state.thrownWeapons.length > 40) state.thrownWeapons = state.thrownWeapons.filter((b) => b.active);
  if (state.blood.length > 400) state.blood = state.blood.filter((b) => b.ttl > 0);
  if (state.pickups.length > 100) state.pickups = state.pickups.slice(-100);
}
