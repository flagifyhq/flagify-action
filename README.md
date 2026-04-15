# flagify-action

Evaluate a [Flagify](https://flagify.dev) feature flag in a GitHub Actions workflow. Use it to gate deploys, skip test suites, or branch a workflow based on flag state.

## Usage

```yaml
- name: Check feature flag
  id: flag
  uses: flagifyhq/flagify-action@v1
  with:
    api-key: ${{ secrets.FLAGIFY_API_KEY }}
    flag: new-checkout-flow

- name: Deploy
  if: steps.flag.outputs.enabled == 'true'
  run: ./deploy.sh
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | yes | — | Your Flagify public key (`pk_*`). Store it as a repo secret. |
| `api-url` | no | `https://api.flagify.app` | API base URL. Override for self-hosted. |
| `flag` | yes | — | The flag key to evaluate (kebab-case). |
| `user-id` | no | `""` | Optional user id for targeting rules. |
| `user-attributes` | no | `{}` | JSON object with user attributes for targeting. |
| `fallback` | no | `"false"` | Value returned when the flag cannot be evaluated. |
| `on-disabled` | no | `continue` | What to do when the flag is disabled. `continue` (emit outputs, proceed), `fail` (mark the step as failed — dependent jobs skip), `skip` (log + continue, downstream should gate on `outputs.enabled`). |

## Outputs

| Output | Description |
|---|---|
| `value` | The evaluated flag value as a string. |
| `enabled` | `"true"` if the value is truthy (`true`, `1`, `yes`, `on`), `"false"` otherwise. |
| `reason` | Why the flag resolved this way (targeting, fallthrough, error, etc.). |

## Examples

### Gate a production deploy

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check deploy gate
        id: gate
        uses: flagifyhq/flagify-action@v1
        with:
          api-key: ${{ secrets.FLAGIFY_API_KEY }}
          flag: production-deploys-enabled

      - name: Halt if gate is off
        if: steps.gate.outputs.enabled != 'true'
        run: |
          echo "production-deploys-enabled is off — exiting."
          exit 0

      - run: ./deploy.sh
```

### Run a longer test suite only when a flag is on

```yaml
- name: Check canary flag
  id: canary
  uses: flagifyhq/flagify-action@v1
  with:
    api-key: ${{ secrets.FLAGIFY_API_KEY }}
    flag: run-canary-tests

- name: Canary suite
  if: steps.canary.outputs.enabled == 'true'
  run: npm run test:canary
```

### Fail the job when a flag is off (kill-switch)

Use `on-disabled: fail` to mark the step as failed when the flag resolves to a falsy value. Dependent jobs that use `needs:` skip automatically.

```yaml
- name: Require production deploys enabled
  uses: flagifyhq/flagify-action@v1
  with:
    api-key: ${{ secrets.FLAGIFY_API_KEY }}
    flag: production-deploys-enabled
    on-disabled: fail

- name: Deploy
  run: ./deploy.sh
```

### Target by user attributes

```yaml
- uses: flagifyhq/flagify-action@v1
  with:
    api-key: ${{ secrets.FLAGIFY_API_KEY }}
    flag: pro-features
    user-id: ${{ github.actor }}
    user-attributes: '{"role":"maintainer"}'
```

## Development

```bash
pnpm install
pnpm run build   # bundles src/main.ts → dist/index.js (committed)
pnpm run lint
```

`dist/` is committed to the repo — GitHub Actions runs the bundled output directly without installing dependencies.

## License

MIT
