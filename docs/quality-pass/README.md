# Stormcrown gameplay and graphics update

Validated locally on 12 September 2026. This record describes the working-tree
changes based on commit `e2afdc31694e0db2f17f772ec5e007ae947c976d`; the changes have
not been committed, pushed, or deployed. The generated static build was created
at `2026-09-12T09:02:31.003Z` and retains application version 1.0.0.

## Gameplay fixes

- Short guard taps retain their parry window after release and can buffer through
  dodge recovery. Held attacks respect guarding, and heavy attacks require their
  stamina cost. Staggering an enemy cancels an unfinished regular attack.
- Death, revival, party switching, and final-oath attunement clear stale input,
  motion, harmful status, and scheduled work as appropriate. Revived companions
  are placed on walkable ground. Dodged pinning projectiles no longer apply stun.
- Encounter starts are idempotent, and defeated encounters cannot complete.
  Victory pauses combat and grants its reward once. Recruitment and rewards
  remain protected until their continuation action finishes the flow.
- Optional discoveries and reward credit survive checkpoint save/reload without
  preserving kills from a partially completed encounter. Repeating the cathedral
  choice does not repeat its one-time splinter grant. Retry checkpoints retain
  defeat counts. Trial access counts story missions rather than optional missions.
- Warden mast collisions now match the visible masts. The ship's tapered outline,
  platform shapes, bridge openings, and descending bridge heights agree with the
  traversable geometry.

Save format 3 and the original 40 story mission identifiers/order are retained.
The browser tests use isolated storage and do not access an existing player save.

## Visuals and motion

Corrected floor outlines and cliff normals, replaced the overlapping ship hull
with a shared outline, and aligned bridge ramps with platform edges. Softer torch
bloom, brighter character materials, a subtle rim light, and a closer gameplay
camera improve battlefield readability. Reefed Warden sails leave the crew visible.

Character poses blend across action transitions. The renderer interpolates
positions and turns between the 60 Hz simulation ticks without changing gameplay
state. Torren's beast form and the World Beast now have twelve articulated leg
joints instead of legs attached rigidly to their body.

Moving electrical curtains follow their collision footprints. Advancing lava has
a molten-crust shader and a leading rim that grows with the hazard. Particle and
debris submission is limited to live effects; weather respects quality settings.
Temporary graphics resources are released during scene transitions.

The update uses the existing bundled PBR materials and procedural meshes. No new
Blender models or external runtime asset downloads were used; existing asset and
vendor licenses/provenance remain intact.

## Added expeditions

Open **The Warden → Chart a course → Expeditions** and choose the kingdom.

| Mission | Unlock | New route |
| --- | --- | --- |
| The Stormglass Causeway (`x01`) | 4 story missions; Stormreach; level 5 | Four encounters: moving-wall combat, grounding puzzle, beacon defense, Colossus boss |
| The Mountain Runs Red (`x02`) | 12 story missions; Cinderfall; level 12 | Five encounters: worker rescue, siphon sabotage, two descending lava escapes, final oath |

Both routes have dialogue, encounter checkpoints, completion rewards, and replay
support. They extend the [design brief's](../reference/original-game-brief.md)
moving-lightning-wall and collapsing-volcano concepts. They are optional and do
not change the next story chapter.

## Verification

| Command / check | Observed result |
| --- | --- |
| `npm test` | 65 tests passed, including production-input traversal of all 40 story missions, all eleven final anchors, both expeditions, controls, saves, navigation, combat state, and render interpolation |
| `npm run check` | Passed: 16 bundled asset checksums, 64 reachable browser modules, 49 authored JavaScript syntax checks, 47 recovered files present |
| `python tests/browser.py` | 43 checks passed; zero JavaScript/shader errors and zero failed runtime asset requests |
| Additional Oathkeeper expedition runs | Both `x01` and `x02` reached victory through production input/combat with no party defeat |
| `npm run build` | Passed; self-contained `dist/` generated |
| `python tests/build-browser.py` | 6 checks passed against the generated build over HTTP: startup, story launch, movement, persistent checkpoint reload, and no script/shader/network failures |
| `git diff --check` | Passed; Windows LF/CRLF notices only |

The full simulation test run completed in approximately 9.76 seconds of host time.
Automated pilots run the production simulation faster than real time; this is not
a measure of campaign duration. The additional Oathkeeper runs used profiles with
preceding chapter rewards as fixtures, then completed the expeditions through
normal movement/combat commands. Neither the campaign nor expedition pilot
teleports, directly kills enemies, or grants itself victory.

The browser geometry checks covered 19 floors and 19 cliffs, the ship hull, both
beast forms, position interpolation, and the optional ambient-occlusion pass.
Across three repeated visits to all five regions, the same return-to-hub fixture
reported **57 geometries and 39 textures** each time. This establishes stable GPU
resource counts for that tested transition sequence, not a general leak proof.

Validation used Node.js 24.14.0, Python 3.10.10, and Chromium/WebGL through ANGLE
SwiftShader at 1280×720. A separate 390×844 view checked mission-board navigation.
Source tests used port 4178; the built-game smoke test used port 4179. Each test
closed its own server and browser.

The opening high-quality render sample submitted 122 draws and 372,282 triangles.
The prior baseline submitted 127 draws and 447,142 triangles, but camera and live
encounter timing differ, so these counts are not a controlled performance
comparison. Synchronous SwiftShader timings and the harness's synthetic frame
updates are **not evidence of consumer GPU FPS**. Human control feel, every
possible party/build combination, the brief's campaign-hour target, and reference
image parity are not certified by these checks.

## Preserved evidence

- [Source browser report](browser-report.json): all 43 checks, sampled scenes,
  rendering diagnostics, resource counts, and the working-tree snapshot.
- [Built-game report](build-report.json): the six independent `dist/` checks and
  build timestamp.
- Screenshots: [opening combat](02-gameplay.png), [Stormglass Causeway](04-stormglass.png),
  [lava escape](05-lava-escape.png), [Warden deck](06-warden.png), and
  [narrow-screen mission board](07-mobile-board.png).

These screenshots were captured from the running game, with interface transition
animations completed before capture. The lava overview temporarily uses the
existing camera zoom setting at 1.4 to show more of the escape route. Gameplay
state was reached through the production pilot. The full transient reports,
baseline screenshots, and failed attempts remain under Git-ignored
`test-results/`; historical recovery documents remain unchanged.

The browser pass found and resolved two validation issues: the lava capture was
originally scheduled after the pilot had already left the encounter, and the new
lava shader used the GLSL-reserved identifier `active`. Captures now wait for a
live hazard, presentation effects age with the simulation, and the shader uniform
is named `lavaActive`. Final source and generated-build runs both passed.
