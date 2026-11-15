[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/belski21-growl/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/belski21-growl/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Wispkeeper — Lantern of the Night Garden

A complete, original 2D canvas game for make.fun's **best-game-01** ($1,000,
10 places). No library, no network at runtime: plain ES modules, a canvas, and
synthesised WebAudio sound.

## The game

You are the Wispkeeper, carrying a living lantern through a night garden.
Golden wisps drift through the dark; guide them into your lantern's light
before dawn breaks. Shadow moths hunt your flame — burn them with a pulse of
light before they strike.

- **Five nights.** Each night asks for more wisps (12 → 28) before a shorter
  dawn timer runs out. Clear a night for a dawn bonus; survive all five and
  morning breaks — you win.
- **Three flames.** A moth strike costs one flame and breaks your combo.
  Three strikes snuff the lantern out. Dawn breaking with the lantern unfilled
  ends the run too.
- **Combo scoring.** Wisps gathered in quick succession climb a x1–x5 combo;
  the chime climbs with it. Burning a moth is worth 25 points.
- **Pulse.** Click or Space fires a ring of light that burns moths. It costs
  energy, recharges over time, and has a short cooldown — spend it well.

## Controls

| Input | Action |
| --- | --- |
| Mouse | The lantern eases toward the pointer |
| WASD / arrow keys | Steer the lantern |
| Click / Space | Fire the pulse (or confirm on menus) |
| P / Esc | Pause |
| M | Mute |

## Screens

Title (with instructions and best score) → play with a full HUD (score, best,
night, dawn timer, wisps gathered, flames, pulse energy, combo) → night-cleared
interstitial → game over or victory, each with run statistics and restart.
Best score is kept in `localStorage`.

## Structure

```
game/
  index.html            the page: one canvas, one module script
  src/
    config.js           every tuning number, the night table, the palette
    random.js           the seeded generator (mulberry32) + helpers
    audio.js            all sound, synthesised with WebAudio (no audio files)
    input.js            keyboard + mouse, one-shot actions
    world.js            the rules: lantern, wisps, moths, pulse, dawn
    render.js           everything seen: garden, lantern, HUD, screens
    shots.js            deterministic screenshot scenes (?shot=…)
    main.js             boot, the fixed-step loop, screen flow
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the kit's
`vendor/makefun-game.ts`.

## Play it

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

Or open `game/index.html` from any static server. The screenshot scenes are
staged deterministically: `?shot=start|play|end|win&seed=N`.

## License

MIT — see [LICENSE](LICENSE). SPDX-License-Identifier: MIT.
