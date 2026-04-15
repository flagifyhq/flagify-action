# Changelog

All notable changes to this action are documented here. Tags follow
[semver](https://semver.org). The release workflow moves the major
tag (`v1`) to the latest release in that line automatically, so
`uses: flagifyhq/flagify-action@v1` always points at a stable release.

## [1.0.1] — unreleased

### Changed
- Renamed the action to `Flagify Feature Flags` so it can be published to the GitHub Marketplace (the previous name collided with an existing listing). No runtime change; `uses: flagifyhq/flagify-action@v1` continues to resolve.

## [1.0.0]

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
