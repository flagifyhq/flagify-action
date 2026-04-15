# Changelog

All notable changes to this action are documented here. Tags follow
[semver](https://semver.org) and move the major tag (`v1`) to the
latest release in that line automatically.

## [0.2.0] — unreleased

### Added
- `on-disabled` input with three modes:
  - `continue` (default) — emit outputs, proceed. Backward-compatible.
  - `fail` — `core.setFailed` when the flag is disabled so dependent jobs skip.
  - `skip` — log a `notice` when disabled; downstream gates on `outputs.enabled`.

## [0.1.0] — 2026-04-15

### Added
- Initial release.
- Evaluates a Flagify feature flag via `POST /v1/eval/flags/:flag/evaluate`.
- Inputs: `api-key`, `api-url`, `flag`, `user-id`, `user-attributes`, `fallback`.
- Outputs: `value`, `enabled`, `reason`.
- Graceful fallback on network errors and non-2xx responses.
