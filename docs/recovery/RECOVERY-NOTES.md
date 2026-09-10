# Recovery record

The archive includes all 47 files under the mounted sandbox project folder,
without changing their contents. Source files from the earlier unfinished
implementation are not represented as newly completed game features.

The historical repository asset bundle was restored locally at commit
`a85ea88594ede79b6c4da4d6a11bc51641b81477`. Its PBR maps, HDR environment,
Three.js library/add-ons, lockfile, licenses, build-acquisition scripts and
workflows were retained. Game source files from the sandbox take precedence
over the earlier repository files (notably package.json).

The independently acquired anatomy source is included with its original
license/provenance, but the current renderer does not import it.

Additional fixes or the 33-test suite mentioned in earlier conversation replies
were not present among the mounted source files. They have not been invented or
represented as recovered. Previous browser scripts and logs are kept as evidence
of earlier work, not as new test results.

Fresh packaging verification: all 47 original-source hashes matched; all 16
PBR/environment asset hashes matched; 60 browser modules resolved locally;
45 authored JavaScript/tool files passed node --check; the new package test and
static build passed. This does not validate all gameplay mechanics.

A normal-HTTP browser check was attempted. The Node server responded to HTTP,
but headless Chromium refused navigation with ERR_BLOCKED_BY_ADMINISTRATOR.
No browser restrictions were changed. No new in-browser gameplay or save/load
verification is claimed. The blocked result is recorded in http-smoke.json.

No GitHub push was performed during this archive handoff.
