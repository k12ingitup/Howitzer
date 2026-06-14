# HOWITZER — Project Brief

A modern, enhanced take on **Pocket Tanks**: a turn-based, score-based artillery
duel built around a large, creative weapon library, destructible *and*
constructible terrain, and tight game feel. Targeting mobile (iOS + Android) from
a single web codebase.

A working single-file prototype exists at `prototype/tank-artillery.html` — use it
as the reference for physics tuning, aiming feel, and visual direction, then
supersede it with the real architecture below. Do not keep building inside that
one file.

---

## What "Pocket Tanks but enhanced" actually means

This is the part that's easy to get wrong, so it's pinned here. Pocket Tanks is
**not** last-tank-standing like Scorched Earth. The defining mechanics:

1. **Score-based, not health-to-zero.** You earn points by how close your shot
   lands to the opponent (full points for a direct hit, falling off with
   distance). A match is a *fixed number of shots per player* (Pocket Tanks uses
   ~10 weapons each). When both arsenals are spent, **highest score wins.** Tanks
   take cosmetic damage but the match isn't decided by a kill.
   > The prototype currently uses HP-to-zero. **Migrate to the score model.**
   > Keep an optional "Annihilation" mode (HP-to-zero) as a variant, but score
   > mode is the default and the soul of the game.

2. **Variety is the whole game.** The fun lives in the weapon library, not the
   physics. Each weapon should feel distinct. This demands a **data-driven weapon
   system** (see Architecture) so adding weapon #45 is a config entry, not new
   engine code.

3. **Terrain is a material, not a backdrop.** Pocket Tanks weapons *add* dirt,
   dig tunnels, roll downhill, and bury opponents — not just blast craters. A
   height-map (one surface y per column, like the prototype) **cannot** express
   overhangs, tunnels, or dirt piles. Move terrain to a **pixel buffer** model
   (see Architecture). This is the most important early refactor.

4. **Fixed tank positions** by default (no driving). Movement only happens via
   specific weapons (jump jets, teleporters) or knockback. Keep it simple first.

---

## Tech stack & rationale

- **TypeScript + HTML5 Canvas 2D** — port the prototype's vanilla JS to TS for
  maintainability as the weapon count grows. Canvas 2D is plenty for this art
  style; no WebGL needed yet.
- **Vite** — dev server + bundler. Fast HMR, trivial build.
- **Capacitor** — wraps the web build into native iOS/Android apps from the same
  codebase. Gives haptics, app-store packaging, and (later) ads/IAP. Add this in
  Phase 4, not before — validate fun in the browser first.
- **No game engine** (Godot/Unity) for now. The web path keeps iteration fast and
  the prototype already proves the approach. Revisit only if perf demands it.
- **Howler.js** for audio (sprite-based, mobile-friendly). Add in Phase 2.

Keep everything offline-capable and dependency-light. No `localStorage` quirks —
persist settings via Capacitor Preferences once native; plain in-memory before that.

---

## Architecture

```
src/
  engine/
    terrain.ts      # pixel-buffer terrain: solid/empty bitmask + render layer
                    #   - destroy(x,y,r), addDirt(x,y,r), settle() (gravity on
                    #     floating dirt columns), collisionAt(x,y)
    physics.ts      # projectile integration, gravity, wind, substepping
    collision.ts    # pixel + tank hit tests
  weapons/
    types.ts        # Weapon, Projectile, ExplosionShape, TerrainEffect interfaces
    registry.ts     # the data-driven library — every weapon is a config object
    behaviors.ts    # reusable building blocks weapons compose:
                    #   onFire (single/spread/burst), inFlight (gravity/homing/
                    #   roll), onImpact (crater/addDirt/tunnel/napalm/cluster)
  game/
    match.ts        # turn order, shots-remaining, scoring, win condition
    scoring.ts      # damage→points falloff curve
    state.ts        # serializable match state (enables async multiplayer later)
  ai/
    opponent.ts     # difficulty-scaled aiming (port + improve prototype's search)
  render/
    renderer.ts     # canvas draw, camera, screen shake
    particles.ts    # explosions, smoke, debris
    fx.ts           # screen shake, hit flashes, number popups
  ui/
    hud.ts          # health/score, wind, turn indicator
    arsenal.ts      # weapon picker (the per-turn weapon selection)
    menus.ts        # mode select, match setup, results
  input/
    aim.ts          # drag-to-aim + slider dials (both, from prototype)
  main.ts           # bootstrap + game loop
assets/             # sounds, sprites, tank skins, terrain themes
```

### Weapon system — the core abstraction

Every weapon is a **declarative config** composing reusable behaviors. Target shape:

```ts
{
  id: "cluster_bomb",
  name: "Cluster Bomb",
  category: "explosive",
  fire:    { kind: "single" },
  flight:  { kind: "ballistic" },              // gravity + wind
  impact:  { kind: "split", count: 3, spread: 0.12,
             child: { impact: { kind: "crater", radius: 26, damage: 22 } } },
  fx:      { sound: "boom_small", shake: 4, particles: "fire" },
}
```

Adding a weapon = appending one object to `registry.ts`. The engine never learns
about specific weapons. This is what lets the library scale to 30, 50, 100 weapons.

### Weapon archetypes to build toward (variety target)

Standard shells (small/big) · MIRV/cluster · Roller (rolls downhill to target) ·
Digger/Tunneler (carves down/through terrain) · Sandhog/Dirt Clod (*adds* terrain
— build walls, bury foe) · Napalm (burning area, damage-over-time) · Tracer
(zero-damage ranging shot, doesn't cost a turn or scores 0) · Laser (instant line)
· Homing · Airstrike (multiple shells from above) · Jump Jet / Teleport (move your
own tank) · Shield / Deflector (defensive, deploys on your turn) · Nuke (huge,
rare). Aim for distinct *feel*, not just bigger numbers.

---

## Roadmap (phases)

**Phase 1 — Real foundation.** Scaffold Vite + TS. Port prototype physics/aiming.
Replace height-map with **pixel-buffer terrain** (destroy + addDirt + settle).
Stand up the **data-driven weapon registry** with ~6 weapons across archetypes.
Implement the **score-based match loop** (N shots each, damage→points, winner by
score). Arsenal picker UI. Local 2-player + vs CPU. *Definition of done: a full
match is playable start to finish in the browser with scoring.*

**Phase 2 — Game feel.** Audio (Howler), richer particles, screen shake, hit
flashes, floating damage/score popups, turn transitions, wind animation. Match
setup screen (shots count, mode). This is where it starts to feel like a real game.

**Phase 3 — Content.** Grow to 25–30+ weapons. Multiple terrain themes/palettes.
Tank skins. Per-match random arsenal draw (each player gets a random weapon set,
Pocket-Tanks style) + a "pick your loadout" alternative.

**Phase 4 — Native packaging.** Add Capacitor. iOS + Android builds. Haptics on
fire/hit. Safe-area handling, app icons, splash, store screenshots.

**Phase 5 — Reach & revenue (optional, decide later).** Async online multiplayer
(the serializable match state in `game/state.ts` is the hook). Monetization:
cosmetic tank/terrain skins, weapon packs, ad-gated extras. No dark patterns.

---

## Conventions

- TypeScript strict mode. Small, pure modules; engine has no DOM dependencies so
  it stays testable and portable.
- Keep the game loop fixed-timestep with substepping for projectile collision
  accuracy (the prototype substeps 4× — keep that).
- All tunable numbers (gravity, power scale, blast radii, score falloff) live in a
  single `config.ts` so balancing doesn't mean hunting through files.
- Commit per working increment. Run the dev build and confirm a shot fires before
  moving on.
- When unsure about a Pocket Tanks mechanic, default to: score-based, variety-first,
  terrain-as-material.

## Working agreement for the agent

Start by reading `prototype/tank-artillery.html` to absorb the physics constants
and aiming feel, then build Phase 1 in the structure above. Don't try to do all
phases at once — get a scoring match fully playable first, then we iterate.
