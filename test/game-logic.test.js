import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, movePlayer, resolveCombat, checkWin, LEVEL } from '../src/game-logic.js';

test('player movement is clamped inside level bounds', () => {
  const state = createInitialState();
  movePlayer(state, { moveX: -100, moveY: 0, aimX: 0, aimY: 0 }, 1);
  assert.equal(state.player.x, state.player.radius);
});

test('bullet damages and can kill enemies', () => {
  const state = createInitialState();
  const enemy = state.enemies[0];
  state.bullets.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, active: true });
  resolveCombat(state, 0.016);
  assert.equal(enemy.hp, 1);
  state.bullets.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, active: true });
  resolveCombat(state, 0.016);
  assert.equal(enemy.alive, false);
});

test('win condition requires all enemies dead and player inside exit', () => {
  const state = createInitialState();
  for (const e of state.enemies) e.alive = false;
  state.player.x = LEVEL.exit.x + 10;
  state.player.y = LEVEL.exit.y + 10;
  checkWin(state);
  assert.equal(state.player.won, true);
});
