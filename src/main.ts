import * as core from '@actions/core'

interface EvaluateResponse {
  key: string
  value: unknown
  reason: string
}

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api-key', { required: true })
    const apiUrl = (core.getInput('api-url') || 'https://api.flagify.app').replace(/\/$/, '')
    const flag = core.getInput('flag', { required: true })
    const userId = core.getInput('user-id') || ''
    const userAttrsRaw = core.getInput('user-attributes') || '{}'
    const fallback = core.getInput('fallback') || 'false'

    let userAttributes: Record<string, unknown>
    try {
      userAttributes = JSON.parse(userAttrsRaw)
      if (typeof userAttributes !== 'object' || userAttributes === null || Array.isArray(userAttributes)) {
        throw new Error('user-attributes must be a JSON object')
      }
    } catch (err) {
      core.warning(`Invalid user-attributes JSON — using {}. ${(err as Error).message}`)
      userAttributes = {}
    }

    const url = `${apiUrl}/v1/eval/flags/${encodeURIComponent(flag)}/evaluate`
    core.debug(`POST ${url}`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ userId, attributes: userAttributes })
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      core.warning(
        `Flagify API returned ${res.status}. Using fallback "${fallback}". Body: ${body.slice(0, 200)}`
      )
      emitResult(fallback, 'error')
      return
    }

    const data = (await res.json()) as EvaluateResponse
    const value = data.value === null || data.value === undefined ? fallback : String(data.value)
    emitResult(value, data.reason || 'ok')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    core.setFailed(`flagify-action failed: ${message}`)
  }
}

function emitResult(value: string, reason: string): void {
  const enabled = isTruthy(value) ? 'true' : 'false'
  core.setOutput('value', value)
  core.setOutput('enabled', enabled)
  core.setOutput('reason', reason)
  core.info(`flag resolved → value=${value} enabled=${enabled} reason=${reason}`)
}

function isTruthy(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'on'
}

run()
