[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/belski21-growl/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/belski21-growl/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# ASHEN HOLLOW — The Hearth Has Gone Cold

A complete, original dark JRPG for make.fun's **best-game-01** ($1,000,
10 places). No library, no network at runtime: plain ES modules, a canvas,
pixel sprites drawn in code, and synthesised WebAudio chiptune. A modern
JRPG with the soul of a classic — and the mood of a dark rogue: an overworld
of scorched earth and haunted woods, people to talk to, and turn-based
battles against the cold that stole the hearth.

## The game

The hearth-flame of Aldermere has gone cold. Ash the Hearthwarden, Mira the
Embercaller, Bram the Bulwark, Rowan the Deadeye, Vex the Nightblade and
Liora the Dawncaller set out to gather the three Ember Crystals — Gale,
Dawn and Tide — from their guarded shrines, then face the Hollow King at
the Ashen Throne and bring the warmth back. Only four fight at a time;
two wait in reserve in Aldermere and still earn half the XP.

- **Overworld.** A 40×30 pixel-art map of six dark biomes: Aldermere
  (gothic dark village), the Howling Crags (cave), the Wraithwood
  (haunted forest), the Venomfen (poison river), the Bonefields and the
  Ashen Throne. Walk with WASD/arrows or click a tile to walk there; talk
  to Elder Maren, Pip, Torchwarden Torin and a dozen villagers whose
  dialog changes as crystals are won; follow the quest tracker from
  shrine to shrine. Houses, lanterns, graveyards and ruins are all
  different; smoke, embers and fog drift on game time. Giant landmarks
  (the Wraithwood spirit tree, the fanged cave mouth, the overflowing
  poison flood, the Bonefields ribcage, the ruined statue, the throne
  thorns) dominate their zones, and the party lantern throws a warm
  pool of light through the dark.
- **Battle spectacle.** Ultimates fire layered shockwave rings,
  ground fractures, screen shake and big popping damage numbers; the
  boss carries a drifting purple aura with pulsing red eyes, and hits
  flash the sprite's own silhouette white instead of a blank box.
  The visuals are driven by a separate seeded generator, so the
  spectacle never eats combat dice — damage rolls are unchanged.
- **Hearthfire checkpoints + saving.** Campfires in the village and near
  every shrine save the whole run to `localStorage` (crystals, levels,
  inventory, equipment, party, quests) — interact and see "Progress
  saved". A crystal auto-saves too. The title screen offers Continue.
  Rest at the inn to restore the party's HP/MP for free.
- **Side quests + a mystery.** Five side quests from the villagers
  (kill Cave Wraiths, gather tide seals and gravewax, find lost lanterns,
  deliver a sealed letter), tracked in a quest log on the pause screen,
  paying XP, gold and equipment. One hidden quest — talk to the silent
  gravekeeper three times after two crystals — and one hidden boss, the
  Grief Below (HP 240, stronger than any shrine guardian), waiting behind
  the great spirit tree. Its location is only ever hinted at, never
  arrowed.
- **Party of six, four active.** Ash (Warrior/Vanguard, Emberblade),
  Mira (Wizard/Arcane, Galeweave Staff), Bram (Tank/Sentinel,
  Gravehammer), Rowan (Marksman/Deadeye, Marrowbow), Vex (Assassin/
  Nightblade, Griefsplitter Daggers) and Liora (Healer/Dawncaller, Sunlit
  Staff). Press Tab for the Party menu: swap an active hero with a
  reserve outside battle; reserves earn 50% XP. Each hero is readable at
  a glance — sword, staff, tower shield + hammer, bow + quiver, twin
  daggers, holy staff — with name, class, role and weapon on the HUD,
  in battle and on the title screen.
- **Equipment, three tiers each.** Every hero equips one weapon, one
  armor and one accessory (54 pieces, tier I → II → III), raising atk,
  def, HP, MP and speed. Tiers come from shrine bosses, side quests, the
  mystery quest, the hidden boss — or the village blacksmith, who forges
  an upgrade from three monster-drop materials. Manage it in the Party
  menu (Tab, then Tab again for Equipment).
- **Random encounters.** Tall grass hides Gloomshades, Gravebats, Pale
  Wisps, Acidmires, Ashen Hounds, Venomcoils, Rattlebones,
  Rotshamblers and Cave Wraiths — nothing cute, nothing bright. Win to
  earn XP and gold; the party levels up, grows stronger, and learns new
  skills. Venomcoil's bite can poison; Antidote cures it.
- **Turn-based battles.** Attack, Skill, Item or Run, with a speed-ordered
  turn queue, damage numbers, crits, guard and stun, boss-only attacks
  (the Hollow Wave every third turn), and a 1x/2x battle-speed toggle.
  Only the four active heroes fight. Each hero has a class, a role and a
  passive perk that really runs: Ash (Vanguard) counters with Ember
  Riposte, Mira (Arcane) regains MP with Emberwell, Bram (Sentinel)
  guards harder with Aegis Guard, Rowan (Deadeye) crits more often with
  Hawkeye, Vex (Nightblade) deals more damage to low-HP foes with
  Executioner, Liora (Dawncaller) regains the party a little HP each
  round with Grace. Items: Potion, Ether, Elixir (full HP+MP), Phoenix
  Tear (revive at 50% HP) and Antidote; bosses drop Elixir.
- **Spectacular skills.** Each hero has 2 skills + 1 ULTIMATE (unlock
  Lv2, once per battle): Ash's **Ashen Requiem** (five burning slashes),
  Mira's **Hollowfire Cataclysm** (an explosion that hits all foes),
  Bram's **Hearthwall Judgment** (a shield slam that guards the party),
  Rowan's **Storm of Arrows** (a deadly multi-hit arrow volley), Vex's
  **Umbral Flurry** (multi-hit shadow slashes) and Liora's **Sanctum of
  Dawn** (a great heal that revives fallen allies). Ultimates come with
  a big name card, element flash, layered particles, shockwave rings,
  cracked ground, screen shake and a slow-mo beat before the damage
  lands.
- **Three shrine guardians, one final boss — and one hidden.** Galehowl,
  Dawnwing and Tidecoil each guard a crystal; the Hollow King waits
  behind all three at the throne. Lose and the party wakes back in
  Aldermere, healed and ready.
- **Modern comforts.** Smooth tile movement with a trailing party, pause,
  mute, generated chiptune themes (title / field / battle), and best progress
  (crystals, victories, best time) kept in `localStorage`.

## Round 3 — Emberwyrm Ascension (revision)

Round 3 is a readability pass plus a new headline moment, built on the
round-2 game without changing its rules. The field is brighter and easier
to read — landmarks, enemies and the party lantern stand out against the
dark instead of sinking into it — bosses loom larger in battle, damage
numbers are bigger, and the victory screen shows the hearth and the whole
party clearly.

The centrepiece is Ash's **Emberwyrm Ascension**: once per battle, when
Ash fires his ultimate, he does not just swing his sword — he becomes a
dragon. A hand-drawn ember wyrm (idle and breath atlases, drawn from the
game's own pixel art) fills nearly half the battle screen, breathes a cone
of fire across the foes, and then Ash returns to his normal sprite. It is
a once-per-battle transformation, not a permanent form, and the fight
carries on exactly as before.

Around it, three smaller systems make battles and exploration feel more
alive. **Ember Arts** is a combo meter: landing hits in a row builds a
streak, and the meter rewards clean play with visible feedback instead of
silent numbers. Bosses now drop loot worth looking at — the drop toast
names the item in its rarity colour, and equipment drops can arrive with
extra affixes, so two drops of the same piece are not always the same.
Out on the field, the shrines hide a small puzzle, **Kindle the
Braziers**: light the braziers in the right pattern to open the way
forward. And the Hearth itself grows with you — three upgrade tiers that
make Aldermere's fire stronger, plus three **Stars of the Hearth** to
find, each one a small permanent light for the party's home.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk (hold to keep walking) |
| Click a tile | Walk there; click a nearby person, shrine or throne to interact |
| E / Space / Enter | Talk, open shrines, advance dialog, confirm in battle |
| Arrow keys + Enter | Battle menus (or click the menu) |
| Tab | Party menu (swap active/reserve, Tab again for Equipment) |
| P / Esc | Pause / resume |
| M | Mute |
| 1 / 2 | Battle speed 1x / 2x |
| H | How to play (title screen) |
| N | New game (title screen, when a save exists) |

## Screens

Title (with instructions and best progress) → overworld with a full HUD
(party HP/MP, class + role + perk, crystals, gold, quest tracker, region
banners) → battle with turn menus, skill-name cards and damage numbers →
pause → game over (respawn in town) or victory with run statistics and
restart. A screen-reader status line announces screen changes.

## Structure

```
game/
  index.html            the page: one canvas, one module script
  src/
    tuning.js           every tuning number, view size, palette, move timing
    dice.js             the seeded generator (mulberry32) + helpers
    story.js            the map + dark biomes, NPCs, dialogues, skills,
                        party classes/perks, enemies, and every pixel
                        sprite as a string bitmap
    field.js            the overworld rules: walking, talking, shrines,
                        the throne, encounters, the quest, click-to-walk
    combat.js           the turn-based battle rules: menus, skills,
                        ultimates + FX state, items, XP, gold, level-ups,
                        boss attacks, running, class perks
    chiptune.js         all sound, synthesised with WebAudio (no audio files)
    keys.js             keyboard + mouse, held directions, one-shot actions
    painter.js          everything seen: tiles, sprites, HUD, dialog,
                        battle + ultimate spectacle, title, victory,
                        game over, pause
    dragon-atlas.js     the Emberwyrm dragon atlases (idle + breath):
                        loader + draw calls, with a sprite fallback
                        if the atlas files cannot load
    frames.js           deterministic screenshot scenes (?shot=…)
    boot.js             boot, the fixed-step loop, screen flow
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the kit's
`vendor/makefun-game.ts`.

## Play it

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

Or open `game/index.html` from any static server. The screenshot scenes are
staged deterministically:
`?shot=title|field|battle|battle-ult|victory&seed=N`.

## License

MIT — see [LICENSE](LICENSE). SPDX-License-Identifier: MIT.
