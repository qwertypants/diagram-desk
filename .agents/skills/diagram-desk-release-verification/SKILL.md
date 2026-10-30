---
name: diagram-desk-release-verification
description: Use when preparing or verifying a Diagram Desk release, checking stale installed content, changing the service worker, investigating offline behavior, or validating a rollback.
---

# Verify a Diagram Desk release

Use this skill to establish what the built, deployed, and installed library actually does. Read [PWA operations](../../../docs/pwa.md) and [deployment](../../../docs/deployment.md) for current commands and hosting behavior. This skill does not authorize a push or publication.

## Choose the checks

- For article or diagram changes, run `npm test`, build the Pages base, then run static and PWA checks.
- For routes, navigation, or reader changes, add the production browser check at desktop and phone widths.
- For service worker, installation, cache, update, or rollback changes, also run installation, offline, and two-release update acceptance.
- For publication, verify terminal CI and deployment status, then check changed public routes and reader interactions at the deployed URL.

Use Node 24+, `npm ci`, and the configured root or `/diagram-desk/` base. Follow `docs/pwa.md` to build and preview the production output. Never infer Pages behavior from a development server.

## Verify an update

A first install must acquire its initial controller without an unnecessary reload. A controlled page receiving a complete release must stay usable while the new cache is prepared, then reload once when the new worker controls it. Confirm the page displays the new content and the new cache version. If a candidate download fails or its digest is wrong, confirm the prior complete release remains usable online and offline. A rollback is another release and must converge by the same process.

Run the repository's two-release browser acceptance when available. Otherwise record that this transition was not tested; the single-build offline check does not prove upgrade or rollback behavior. Use local production builds for failure injection, never corrupt a live release.

## Report evidence precisely

Record the source SHA, build base, commands and results, browser scenario results, CI run state, deployed revision, and URLs checked. Mark unavailable evidence as not tested. A successful build does not establish deployment. HTTP 200 does not establish correct content or working reader controls. Browser simulation does not establish physical installation or storage persistence.

Keep test registrations, caches, preview processes, and temporary build copies isolated and clean them up. Preserve relevant logs until the result is reported. Do not clear the user's browser data.
