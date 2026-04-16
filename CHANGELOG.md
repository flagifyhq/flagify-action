# Changelog

All notable changes to this action are documented here. Tags follow
[semver](https://semver.org). The release workflow moves the major
tag (`v1`) to the latest release in that line automatically, so
`uses: flagifyhq/flagify-action@v1` always points at a stable release.

## [unreleased]

### Added
- Test suite with 14 tests covering `parseOnDisabled`, `isTruthy`, and the `run()` flow
  (happy path, HTTP 500 fallback, network error fallback, `on-disabled=fail`,
  `on-disabled=skip`, invalid `user-attributes` JSON). Uses `node --test` with `tsx`.
- CI now runs `pnpm test` on every push and PR.

### Changed
- Split runtime entry (`src/index.ts`) from exported logic (`src/main.ts`) so the module
  can be imported without side effects. `dist/index.js` now bundles from `src/index.ts`.

## [1.0.1] — 2026-04-15

### Changed
- Renamed the action to `Flagify Feature Flags` so it can be published to the GitHub Marketplace (the previous name collided with an existing listing). No runtime change; `uses: flagifyhq/flagify-action@v1` continues to resolve.

## [1.0.0] — 2026-04-15

First stable release. Combines the initial evaluation capability with
the `on-disabled` control input.

### Added
- Evaluates a Flagify feature flag via `POST /v1/eval/flags/:flag/evaluate`.
- Inputs: `api-key`, `api-url`, `flag`, `user-id`, `user-attributes`, `fallback`, `on-disabled`.
- Outputs: `value`, `enabled`, `reason`.
- `on-disabled` input with three modes:
  - `continue` (default) — emit outputs, proceed.
  - `fail` — `core.setFailed` when the flag is disabled so dependent jobs skip (kill-switch).
  - `skip` — log a `notice` when disabled; downstream should gate on `outputs.enabled`.
- Graceful fallback on network errors and non-2xx responses.
