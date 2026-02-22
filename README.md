# Neon Hotline (Multi-Level Pixel Shooter)

A compact browser game inspired by Hotline-style top-down action, with synthwave/pixel-art visuals, multiple levels, weapon pickups, and enemy patrol AI.

## Requirements

- Node.js 18+ (for running tests)
- Any modern browser

## Quick Start

1. Open a terminal in the project root.
2. Start a static server:

```bash
python3 -m http.server 4173
```

3. Open your browser at:

```text
http://localhost:4173
```

4. Play from the loaded page.

## How to Play

- **Move:** `W`, `A`, `S`, `D`
- **Aim:** Mouse
- **Shoot:** Left mouse button
- **Pick up weapon:** `E`
- **Throw current weapon:** `Q`
- **Next level (after clear):** `N`
- **Restart current level:** `R`

### Objective

- Eliminate all enemies on each floor.
- Move to the glowing cyan exit tile, then press `N` to go to the next level.
- Use pickups (SMG/shotgun), and throw held weapons when needed.

## Run Tests

```bash
npm test
```

This runs the Node.js test suite for core gameplay logic (movement bounds, combat damage/death, and win condition).

## Project Structure

- `index.html` – page shell and HUD.
- `styles.css` – pixel/synthwave visual theme.
- `src/game.js` – render loop, input, sprites, textures, and drawing.
- `src/game-logic.js` – gameplay rules and level logic.
- `test/game-logic.test.js` – automated gameplay logic tests.
