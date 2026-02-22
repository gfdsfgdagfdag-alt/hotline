import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  createInitialState,
  movePlayer,
  resolveCombat,
  checkProgress,
  playerShoot,
  pickupWeapon,
  throwWeapon,
  updateEnemies
} from '../src/game-logic.js';

test('player movement is clamped inside level bounds', () => {
  const state = createInitialState(0);
  movePlayer(state, { moveX: -100, moveY: 0, aimX: 0, aimY: 0 }, 1);
  assert.equal(state.player.x, state.player.radius);
});

test('player can pickup and throw a weapon', () => {
  const state = createInitialState(0);
  const firstPickup = state.pickups[0];
  state.player.x = firstPickup.x;
  state.player.y = firstPickup.y;
  pickupWeapon(state);
  assert.equal(state.player.weapon.type, 'smg');
  throwWeapon(state);
  assert.equal(state.player.weapon.type, 'pistol');
  assert.equal(state.thrownWeapons.length, 1);
});

test('enemy patrol updates position', () => {
  const state = createInitialState(0);
  const enemy = state.enemies[0];
  const x0 = enemy.x;
  const y0 = enemy.y;
  updateEnemies(state, 0.2);
  updateEnemies(state, 0.2);
  assert.ok(enemy.x !== x0 || enemy.y !== y0);
});

test('level progression requires dead enemies and exit', () => {
  const state = createInitialState(0);
  for (const e of state.enemies) e.alive = false;
  state.player.x = state.level.exit.x + 5;
  state.player.y = state.level.exit.y + 5;
  assert.equal(checkProgress(state), 'next');
});

test('shooting damages enemies', () => {
  const state = createInitialState(0);
  const enemy = state.enemies[0];
  state.player.x = enemy.x - 5;
  state.player.y = enemy.y;
  playerShoot(state, enemy.x, enemy.y);
  for (const b of state.bullets) {
    b.x = enemy.x;
    b.y = enemy.y;
  }
  resolveCombat(state, 0.016);
  assert.ok(enemy.hp < LEVELS[0].enemies[0].hp);
});
