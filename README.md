# STORMCROWN: THE SHATTERED OATH

## Recovered source snapshot

This archive combines **all 47 source/project files currently recoverable from the
conversation sandbox** with the existing repository's bundled runtime dependencies
and art assets. The 47 files are preserved byte-for-byte. Their checksums are in
`docs/recovery/original-sandbox-files.json`.

This is a source handoff, **not a certification that the original game-development
brief has been completed**. Earlier messages mentioned additional campaign tests
and later fixes. Those files were not present in the recoverable sandbox and are
not represented here as recovered or verified. In particular, this archive does
not establish 20 hours of gameplay, reference-image visual parity, a complete
campaign playthrough, or a 60 FPS performance guarantee.

## Run locally

Use Node.js 22 or later. The rendering library and runtime textures are already
included; **no `npm install` is required to launch this snapshot**.

```sh
cd STORMCROWN-THE-SHATTERED-OATH
npm start
```

Open `http://localhost:4173` in a WebGL 2-capable browser with hardware acceleration
enabled. Do not open `index.html` directly with a `file://` URL. The game uses ES
modules, an import map, and HTTP-loaded assets. Gameplay help is available in the
interface. Sound starts after interaction with the page.

The server binds to `0.0.0.0` as in the recovered source; use it on a trusted local
machine/network rather than as an Internet-facing production server.

## Create a static build

```sh
npm run build
node tools/serve.mjs --dist
```

The build copies the runtime into `dist/` and uses relative asset paths. Deploy
the **contents** of `dist/` to a static HTTP host. A prebuilt `dist/` is deliberately
not duplicated inside the source ZIP; it is reproduced with the command above.

## What is included

- `src/`: application, gameplay simulation, combat, abilities, AI, bosses, mission
  director, progression, saves, input, renderer, character/environment construction,
  VFX, weather, audio synthesis, interfaces, and content data.
- `assets/`: 15 PBR texture maps, the HDR environment, asset provenance/checksums,
  and a favicon reconstructed from the already-authored crown icon.
- `vendor/`: pinned Three.js 0.179.1 and its add-on modules, with its license.
- `art-source/anatomy/`: the separately acquired character anatomy OBJ, license
  documents, and provenance. **It is included as source material, not claimed to
  be integrated into the recovered game renderer.**
- `tools/`: original server, build, and asset-fetching scripts; a new packaging
  checker; and a new optional HTTP browser smoke check.
- `.github/workflows/`: workflows recovered from the earlier repository bundle.
  They are historical automation, not proof of a newly deployed release.
- `docs/reference/`: the supplied design brief and visual-reference image.
- `docs/screenshots/`: screenshots preserved from previous development runs.
- `docs/recovery/`: original-source checksums, earlier browser harnesses/logs,
  recovery notes, and fresh packaging validation output.

## Verification

```sh
npm run check
npm test
npm run build
```

`npm run check` and the one new package test verify preservation of the recovered
source, syntax of the authored JavaScript, resolution of modules reachable from
the browser entry, and checksums of the bundled PBR assets. **They are not the
previously mentioned 33 gameplay regression tests.** That earlier suite is not
available in this snapshot.

The original smoke scripts and their original logs are retained unchanged under
`docs/recovery/previous-tests/`. Those legacy scripts use sandbox-specific paths
and an in-memory storage harness; their old results are not evidence of actual
HTTP save/reload persistence. The new optional check at
`tools/smoke-snapshot.py` uses an ordinary local HTTP server and reports its scope
in `docs/recovery/http-smoke.json`. It needs Python with Playwright and Chromium. In this packaging session the
local HTTP server responded, but Chromium navigation was blocked by the execution
environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Therefore no fresh browser gameplay
or save/reload pass is claimed. The exact attempted-check output is preserved.

The checksum comparison to original recovered files is expected to fail once you
intentionally edit those files. Update or remove that recovery-specific assertion
when continuing normal development; it is an archive-preservation check.

## Recovery provenance and changes made only for packaging

The runtime assets and vendor modules were restored from the conversation's
`stormcrown-repository-assets.zip`, containing a Git bundle at commit
`a85ea88594ede79b6c4da4d6a11bc51641b81477` (the asset commit). The sandbox game
source was overlaid afterward, without modifying it. This package is not a claim
that the game source was pushed to GitHub.

Packaging additions: this README, recovery/verification documents, the SVG favicon
reusing the crown path from `src/ui/icons.js`, the anatomy source directory, one
archive-integrity test, the static checker, and the optional HTTP smoke script.
No recovered gameplay implementation file was rewritten during packaging.

Git metadata, credentials, node_modules, generated build output, and font binaries
are not included. Third-party asset and library license/provenance files are
preserved in their respective directories. No new license is asserted over the
user's original brief or game source.
