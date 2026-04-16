import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseOnDisabled, isTruthy, run } from './main.js'

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('parseOnDisabled', () => {
  it('returns each valid mode as-is', () => {
    assert.equal(parseOnDisabled('continue'), 'continue')
    assert.equal(parseOnDisabled('fail'), 'fail')
    assert.equal(parseOnDisabled('skip'), 'skip')
  })

  it('is case-insensitive', () => {
    assert.equal(parseOnDisabled('CONTINUE'), 'continue')
    assert.equal(parseOnDisabled('Fail'), 'fail')
    assert.equal(parseOnDisabled('SKIP'), 'skip')
  })

  it('trims whitespace', () => {
    assert.equal(parseOnDisabled('  fail  '), 'fail')
  })

  it('defaults empty to continue', () => {
    assert.equal(parseOnDisabled(''), 'continue')
  })

  it('defaults unknown values to continue', () => {
    assert.equal(parseOnDisabled('bogus'), 'continue')
    assert.equal(parseOnDisabled('true'), 'continue')
  })
})

describe('isTruthy', () => {
  it('treats common truthy strings as truthy', () => {
    for (const v of ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'ON']) {
      assert.equal(isTruthy(v), true, `${v} should be truthy`)
    }
  })

  it('treats common falsy strings as falsy', () => {
    for (const v of ['false', '0', 'no', 'off', '', 'null', 'undefined', 'random']) {
      assert.equal(isTruthy(v), false, `${v} should be falsy`)
    }
  })

  it('trims whitespace', () => {
    assert.equal(isTruthy('  true  '), true)
    assert.equal(isTruthy('  false '), false)
  })
})

// ─── Integration tests (run() against a local mock API) ──────────────────────

interface MockHandler {
  (req: IncomingMessage, res: ServerResponse): void
}

let server: Server
let baseUrl: string
let handler: MockHandler = (_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ key: 'test', value: true, reason: 'default' }))
}

before(async () => {
  server = createServer((req, res) => handler(req, res))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('server address')
  baseUrl = `http://127.0.0.1:${addr.port}`
})

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

// Each integration test uses a fresh GITHUB_OUTPUT temp file and clean env.
let tmpDir: string
let outputFile: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'flagify-action-test-'))
  outputFile = join(tmpDir, 'output')
  writeFileSync(outputFile, '')
  process.env.GITHUB_OUTPUT = outputFile
  process.exitCode = 0

  // Reset inputs between tests.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('INPUT_')) delete process.env[k]
  }
})

function readOutputs(): Record<string, string> {
  const raw = readFileSync(outputFile, 'utf8')
  const out: Record<string, string> = {}
  // Format: `name<<_GitHubActionsFileCommandDelimeter_\nvalue\n_GitHubActionsFileCommandDelimeter_\n`
  const matches = raw.matchAll(/^([a-zA-Z0-9-_]+)<<(\S+)\n([\s\S]*?)\n\2$/gm)
  for (const m of matches) out[m[1]] = m[3]
  return out
}

function cleanup() {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

describe('run()', () => {
  it('happy path: sets outputs from API response', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ key: 'promo-banner', value: true, reason: 'default' }))
    }
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = baseUrl
    process.env['INPUT_FLAG'] = 'promo-banner'

    await run()

    const out = readOutputs()
    assert.equal(out.value, 'true')
    assert.equal(out.enabled, 'true')
    assert.equal(out.reason, 'default')
    assert.equal(process.exitCode, 0)
    cleanup()
  })

  it('HTTP 500: falls back and reports reason=error', async () => {
    handler = (_req, res) => {
      res.writeHead(500)
      res.end('boom')
    }
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = baseUrl
    process.env['INPUT_FLAG'] = 'whatever'
    process.env['INPUT_FALLBACK'] = 'false'

    await run()

    const out = readOutputs()
    assert.equal(out.value, 'false')
    assert.equal(out.enabled, 'false')
    assert.equal(out.reason, 'error')
    assert.equal(process.exitCode, 0, 'fallback on HTTP error does not fail the step')
    cleanup()
  })

  it('network error: falls back and reports reason=error', async () => {
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = 'http://127.0.0.1:1' // nothing listening
    process.env['INPUT_FLAG'] = 'x'
    process.env['INPUT_FALLBACK'] = 'true'

    await run()

    const out = readOutputs()
    assert.equal(out.value, 'true')
    assert.equal(out.enabled, 'true', 'truthy fallback stays enabled')
    assert.equal(out.reason, 'error')
    assert.equal(process.exitCode, 0)
    cleanup()
  })

  it('on-disabled=fail + flag off: sets process.exitCode=1', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ key: 'kill-switch', value: false, reason: 'default' }))
    }
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = baseUrl
    process.env['INPUT_FLAG'] = 'kill-switch'
    process.env['INPUT_ON-DISABLED'] = 'fail'

    await run()

    const out = readOutputs()
    assert.equal(out.enabled, 'false')
    assert.equal(process.exitCode, 1, 'setFailed should set exit code to 1')
    cleanup()
  })

  it('on-disabled=skip + flag off: step stays green', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ key: 'x', value: false, reason: 'default' }))
    }
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = baseUrl
    process.env['INPUT_FLAG'] = 'x'
    process.env['INPUT_ON-DISABLED'] = 'skip'

    await run()

    const out = readOutputs()
    assert.equal(out.enabled, 'false')
    assert.equal(process.exitCode, 0, 'skip mode never fails')
    cleanup()
  })

  it('invalid user-attributes JSON: warns and uses {}', async () => {
    let receivedBody = ''
    handler = (req, res) => {
      let data = ''
      req.on('data', chunk => (data += chunk))
      req.on('end', () => {
        receivedBody = data
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ key: 'x', value: true, reason: 'default' }))
      })
    }
    process.env['INPUT_API-KEY'] = 'pk_test'
    process.env['INPUT_API-URL'] = baseUrl
    process.env['INPUT_FLAG'] = 'x'
    process.env['INPUT_USER-ATTRIBUTES'] = 'not-json'

    await run()

    const body = JSON.parse(receivedBody)
    assert.deepEqual(body.attributes, {}, 'bad JSON should default to empty object')
    cleanup()
  })
})
