# STORMCROWN: THE SHATTERED OATH

An isometric action RPG set in the floating kingdoms of Aetherra. Take three
companions into battle, switch between them instantly, combine elemental attacks,
and return to the Warden to build the crew's weapons and relationships.

The game includes 40 story missions, 22 companion oaths, 10 Crown echoes,
two optional expeditions, Storm Trials, training, and the final Eleven challenge.
The eleven heroes and five regions retain their original campaign progression.

## Run locally

Use Node.js 22 or later (validated with Node.js 24.14.0). Three.js 0.179.1 and the
runtime textures are bundled; **no `npm install` is required to play**.

```powershell
cd C:\Users\karth\STORMCROWN-THE-SHATTERED-OATH
npm start
```

Open `http://localhost:4173` in a WebGL 2-capable browser with hardware acceleration
enabled. Do not open `index.html` directly with a `file://` URL. The game uses ES
modules, an import map, and HTTP-loaded assets. Gameplay help is available in the
interface. Sound starts after interaction with the page. Keep the terminal running
while playing; Ctrl+C stops the server.

The server binds to `0.0.0.0` as in the recovered source; use it on a trusted local
machine/network rather than as an Internet-facing production server.

## Controls and mission flow

| Action | Keyboard / mouse |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse cursor |
| Attack / heavy attack | Left / right mouse button, or J / K |
| Dodge / guard and parry | Space / Shift |
| First ability / second ability / ultimate | Q / E / R |
| Switch party member | 1 / 2 / 3 |
| Relationship attack / remedy | T / H |
| Interact | F |
| Map / crew and forge / journal / pause | M / I / L / Esc |

Read each objective and follow its gold route markers. Free captives with F, stay
near them until they reach safety, and activate rune seals in the displayed order.
Escape beacons must be reached in order. Red warnings indicate danger; absorbable
blue lightning benefits Rael. A short Shift tap opens the parry window even when
the key is released before the next simulation tick. Heavy attacks cost stamina.

The control guide also lists standard gamepad bindings. Touch devices display a
movement stick and combat buttons. Difficulty and crew builds can be changed
aboard the Warden.

## New expeditions

Open **Chart a course → Expeditions** aboard the Warden and select the kingdom.
These are optional routes; completing them does not advance or reorder the story.

| Mission | Kingdom | Unlock | Recommended level | Encounters |
| --- | --- | --- | --- | --- |
| The Stormglass Causeway (`x01`) | Stormreach | Complete 4 story missions | 5 | 4 |
| The Mountain Runs Red (`x02`) | Cinderfall | Complete 12 story missions | 12 | 5 |

**The Stormglass Causeway:** cross moving lightning walls, solve the grounding
sequence, defend a restored beacon, and face the Colossus. Watch the warning line
and move around the ends of each electrical curtain.

**The Mountain Runs Red:** rescue furnace workers, destroy Imperial siphons, then
descend two spillways as lava consumes the route behind you. Follow four gold
beacons on each descent; the growing molten front deals damage and the escape
timer continues during combat.

Both missions have dialogue, encounter checkpoints, completion rewards and replay
support. Their mechanics extend the moving-wall and volcanic-escape concepts in
the supplied [design brief](docs/reference/original-game-brief.md).

## Saves

The automatic slot records encounter boundaries. Three manual slots and exported
save files remain independent. Reloading a mission restores its encounter start,
with secured discoveries and their reward credit retained. Completed missions,
crew builds and decisions persist. Returning to the Warden clears the active
mission checkpoint; returning to the title retains it.

Save format **3** is retained. Existing story mission IDs and unlock order are
unchanged. Use **Save & load → Export current save** to keep a portable backup.

## Graphics and responsiveness

The renderer uses corrected platform outlines and cliff normals, a shared ship
hull/collision outline, continuous descending bridge ramps, softer torch bloom,
brighter character materials and a closer gameplay camera. Character poses blend
between actions; displayed positions interpolate between the 60 Hz gameplay ticks.
Torren's beast form and the World Beast have articulated legs.

Stormwall curtains follow their moving collision zones, and lava visuals expand
with the advancing hazard. Weather and particles respect quality settings. Only
live particles and debris are submitted, and scene transitions release temporary
graphics resources. Lower render scale or choose Low/Medium in Settings when
needed; adaptive resolution is enabled by default.

## Create a static build

```sh
npm run build
node tools/serve.mjs --dist
```

The build copies the runtime into `dist/` and uses relative asset paths. Deploy
the **contents** of `dist/` to a static HTTP host. Building replaces generated files
inside `dist/`; authored files remain in `src/`. No deployment is performed by the
build command.

## Verification

See the [validation record and screenshots](docs/quality-pass/README.md) for this
update's observed test results and their scope.

```sh
npm run check
npm test
npm run build
python tests/browser.py
python tests/build-browser.py
```

`npm test` covers controls, combat interruption, parries, revival, navigation,
checkpoint persistence, mission rewards, the eleven final anchors, both new
expeditions, render interpolation, and all 40 story missions. The campaign pilot
uses production movement and combat commands; it does not teleport or award itself
victory. It is an automated traversal check, not a human balance assessment.

`npm run check` verifies authored JavaScript syntax, browser module resolution,
the presence of recovered files, and checksums of 16 bundled PBR/HDR assets.
Historical source hashes are reported separately and do not freeze development.

The browser check needs Python, Playwright and its Chromium browser. It uses its
own local server on port 4178 and isolated browser storage, then closes both.
It checks actual keyboard input, menus, pause, HTTP save/reload, expedition board
launches and completion, reward protection, rendered hazards, platform geometry,
creature animation, five-region resource cleanup and narrow-screen navigation.
Reports and screenshots are written to `test-results/browser/` (Git-ignored).
`tests/build-browser.py` separately launches the generated `dist/` on port 4179
and verifies startup, movement and checkpoint reload with no source-tree runtime
fallback. Its evidence is in `test-results/build-browser/`.

Browser render samples use SwiftShader and are diagnostic measurements, **not a
hardware FPS guarantee**. The brief's campaign-hour targets and reference-image
parity are not certified by these tests.

## Source and asset provenance

`src/` contains the game, procedural character/environment geometry, shaders, UI
and synthesized audio. `assets/` contains the bundled textures, HDR environment,
icon and provenance; `vendor/` contains Three.js and its license. This update uses
the existing bundled materials and procedural meshes, without external runtime
asset downloads. `art-source/anatomy/` remains reference source material and is
not the active character renderer.

The recovered runtime assets and vendor modules originally came from
`stormcrown-repository-assets.zip`, containing a Git bundle at commit
`a85ea88594ede79b6c4da4d6a11bc51641b81477` (the asset commit). The sandbox game
source was overlaid afterward. Historical recovery manifests, previous test logs
and screenshots are retained under `docs/recovery/` and `docs/screenshots/`; they
are not evidence for the current build. Third-party licenses remain in their
respective asset/vendor directories. No new license is asserted over the supplied
brief or game source.
