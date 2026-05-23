# USI - Star Fleet (3D Browser Game)

A browser-based space strategy game with 3D graphics (Three.js) that runs completely offline with no server required.

## Credits

This project is based on the original **USI - Star Fleet** DOS game by **Ben Becker**. It is a modernized browser port with extended 3D graphics, refined gameplay, and additional features.

The original DOS source code is included in the [`usi_source/`](usi_source/) directory for reference.

## About the Game

You lead a faction in space and must conquer planets, build ships, and defeat rival factions. Features include:

- **3D graphics** powered by Three.js — perspective and bird's-eye views
- **3 playable factions** (Red, Green, Yellow)
- **Planet building** — expand sectors, produce units
- **Ship combat** — 12 ship types with rock-paper-scissors mechanics
- **AI opponents** — automated enemy logic
- **Mini-map** — overview of the entire battlefield

## How to Play

Open the game in your browser, pick a faction, and control your ships with mouse and keyboard. For detailed instructions, see [help.html](help.html).

## Running Locally

Simply open `index.html` in your browser, or use a local HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Technical Details

- **Vanilla HTML/CSS/JS** — no frameworks
- **Three.js r128** — bundled locally, no external dependencies
- **Fully offline** — everything in one folder

## Files

| File | Description |
|---|---|
| `index.html` | Main entry page |
| `help.html` | Player guide |
| `three.min.js` | Three.js r128 (local) |
| `game.js` | Game engine and main loop |
| `ui.js` | User interface |
| `input.js` | Keyboard and mouse controls |
| `planeten.js` | Planet logic, combat, production |
| `ai.js` | AI logic for opponents |
| `renderer.js` | 2D renderer |
| `three-render.js` | 3D renderer (Three.js) |
| `three-objects.js` | 3D objects (ships, planets) |
| `three-init.js` | Three.js initialization |
| `three-minimap.js` | 3D mini-map |
| `entities.js` | Unit definitions |
| `ship-models.js` | 3D ship models |
| `constants.js` | Game constants |
| `globals.js` | Global variables |
| `language.js` | Internationalization (DE/EN) |
| `vec.js` | Vector helper functions |
| `ships/` | Ship data (JSON) |
| `ship-sprites/` | 2D ship graphics (SVG) |
| `usi_source/` | Original DOS source code (Turbo Pascal) by Ben Becker |

## License

MIT
