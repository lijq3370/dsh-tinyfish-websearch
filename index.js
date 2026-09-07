/**
 * dsh-tinyfish-websearch — host half.
 *
 * Registers a TinyFish-backed WebSearchProvider into the `ctx.web` seam, the
 * same seam the shipped `web-search-perplexity` / `web-search-deepseek`
 * providers and the `dsh-tavily-websearch` plugin use. The browser tool
 * (`dsh-tool-web`) keeps working unchanged: the active provider is pinned by
 * the `web` row's `searchProvider` config, which the profile patch sets to
 * `tinyfish`.
 *
 * Zero runtime imports and no build step: the provider implements the seam's
 * contract structurally (id / available() / search(request, signal)) and
 * errors are plain `Error`s carrying a `code` property (`WEB_PROVIDER_ERROR`
 * / `WEB_ABORTED` / `WEB_PROVIDER_CREDENTIAL_MISSING`). Thrown messages still
 * surface to the model; the `HarnessError`-typed structured metadata the
 * shipped providers emit is the only thing not reproduced. This keeps the
 * package fully portable — it resolves from any install location without
 * depending on the profile module fallback.
 *
 * The API key resolves lazily per search through the credentials seam
 * (`ctx.credentials`), which reads process env → `$DSH_HOME/.credentials.yaml`
 * → `.env`. The browser half (./client.js) provides a Settings → 「TinyFish 搜索」
 * form that writes the key through `credentials.set`, so a key saved in the
 * GUI is picked up by the next search without a restart.
 *
 * Wire format (https://docs.tinyfish.ai/search-api/reference): one GET on the
 * base URL with `query` as a query parameter, `X-API-Key` bearer-style header
 * auth. Search requests consume no credits (free tier: 30 req/min).
 */
/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-tinyfish-websearch'

/** The web seam and the credentials seam this plugin reads. */
export const inject = ['web', 'credentials']

/** Stable provider id; the `web` row's `searchProvider` must name it. */
export const TINYFISH_PROVIDER_ID = 'tinyfish'

/** Default TinyFish Search endpoint; the operation is a GET on the root. */
export const TINYFISH_DEFAULT_BASE_URL = 'https://api.search.tinyfish.ai'

/** Default result count; the seam truncates to the request's bound regardless. */
export const TINYFISH_DEFAULT_MAX_RESULTS = 5

/** Attribution header sent on every request. */
const USER_AGENT = 'dsh-tinyfish-websearch/0.1.0'

/** Config defaults; the row config overrides them wholesale. */
const CONFIG_DEFAULTS = Object.freeze({
  baseURL: TINYFISH_DEFAULT_BASE_URL,
  maxResults: TINYFISH_DEFAULT_MAX_RESULTS,
})

/**
 * Validate and normalize the row config. Unknown shapes fail loud at load
 * (never a silent skip).
 * @param raw - the cordis.yml `config` for this row.
 * @returns the normalized config.
 */
export function resolveConfig(raw) {
  const cfg = { ...CONFIG_DEFAULTS, ...(raw ?? {}) }
  if (cfg.apiKey !== undefined && typeof cfg.apiKey !== 'string') {
    throw new Error('tinyfish-websearch: config.apiKey must be a string')
  }
  if (typeof cfg.baseURL !== 'string' || cfg.baseURL.length === 0 || !URL.canParse(cfg.baseURL)) {
    throw new Error(`tinyfish-websearch: config.baseURL must be a valid URL, got "${String(cfg.baseURL)}"`)
  }
  if (!Number.isInteger(cfg.maxResults) || cfg.maxResults < 1 || cfg.maxResults > 20) {
    throw new Error('tinyfish-websearch: config.maxResults must be an integer in 1..20')
  }
  return cfg
}

/**
 * Map a TinyFish search response to the seam's normalized result shape.
 * TinyFish returns no generated answer, so `content` is always omitted; each
 * `results[]` entry becomes a citeable source (URL always, title/snippet/date
 * when present).
 *
 * @param payload - the parsed TinyFish response body.
 * @returns the normalized result.
 */
export function mapTinyFishResponse(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : []
  const sources = []
  for (const item of results) {
    if (item === null || typeof item !== 'object') continue
    const url = typeof item.url === 'string' ? item.url : ''
    if (url.length === 0) continue
    const source = { url }
    if (typeof item.title === 'string' && item.title.length > 0) source.title = item.title
    if (typeof item.snippet === 'string' && item.snippet.length > 0) source.snippet = item.snippet
    if (typeof item.date === 'string' && item.date.length > 0) source.publishedAt = item.date
    sources.push(source)
  }
  return {
    sources,
    truncated: false,
  }
}

/** Build a plain provider error carrying the seam's machine-routable code. */
function webError(message, code, cause) {
  const error = new Error(message)
  error.code = code
  if (cause !== undefined) error.cause = cause
  return error
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** The TinyFish-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class TinyFishSearchProvider {
  id = TINYFISH_PROVIDER_ID

  constructor(options) {
    this.options = options
  }

  /** Cheap local usability check; must not make network calls. */
  available() {
    const { apiKey, resolveApiKey, baseURL, maxResults } = this.options
    const hasKey = (typeof apiKey === 'string' && apiKey.length > 0)
      || typeof resolveApiKey === 'function'
    return hasKey
      && URL.canParse(baseURL)
      && Number.isInteger(maxResults) && maxResults > 0
  }

  /**
   * Resolve one operation's key: a literal row config wins, then the
   * credentials seam (env → $DSH_HOME/.credentials.yaml → .env). Resolved per
   * search so a key saved in the Settings GUI takes effect without a restart.
   * @returns the resolved key.
   * @throws the missing-credential error when no layer supplies one.
   */
  async #resolveApiKey() {
    const literal = this.options.apiKey
    if (typeof literal === 'string' && literal.length > 0) return literal
    if (typeof this.options.resolveApiKey === 'function') {
      const resolved = await this.options.resolveApiKey()
      if (typeof resolved === 'string' && resolved.length > 0) return resolved
    }
    throw webError(
      'TinyFish search has no API key; set it in Settings → TinyFish 搜索 or export TINYFISH_API_KEY',
      'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  }

  /** Run one TinyFish search; honor `signal` for cancellation. */
  async search(request, signal) {
    const apiKey = await this.#resolveApiKey()
    const url = new URL(this.options.baseURL)
    url.searchParams.set('query', request.query)
    let response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          'x-api-key': apiKey,
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        ...(signal !== undefined ? { signal } : {}),
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw webError('TinyFish search aborted', 'WEB_ABORTED', error)
      }
      throw webError(`TinyFish search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', error)
    }

    if (!response.ok) {
      const status = response.status
      let message = `TinyFish API error (HTTP ${status})`
      try {
        const parsed = await response.json()
        const detail = parsed?.detail?.error ?? parsed?.error?.message ?? parsed?.detail ?? parsed?.message
        if (typeof detail === 'string' && detail.length > 0) message = detail
      } catch (error) {
        // An abort fired mid-body must surface as WEB_ABORTED, not be swallowed
        // into a generic HTTP-error message — cancellation is not a provider
        // error (the seam's cancellation contract).
        if (isAbortError(error)) {
          throw webError('TinyFish search aborted', 'WEB_ABORTED', error)
        }
        // Otherwise: the HTTP status is already captured in `message` above; a
        // malformed/non-JSON error body can only cost a richer message.
      }
      throw webError(message, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json()
      return mapTinyFishResponse(payload)
    } catch (error) {
      if (isAbortError(error)) {
        throw webError('TinyFish search aborted', 'WEB_ABORTED', error)
      }
      throw webError(`TinyFish returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', error)
    }
  }
}

/**
 * Plugin body: register the TinyFish provider with `ctx.web`.
 * @param ctx - cordis context with the injected `web` and `credentials` services.
 * @param rawConfig - the cordis.yml row config.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  ctx.web.registerSearchProvider(new TinyFishSearchProvider({
    // Literal row config wins; otherwise the credentials seam resolves
    // `TINYFISH_API_KEY` (env → .credentials.yaml → .env) per search.
    apiKey: config.apiKey ?? '',
    resolveApiKey: () => ctx.credentials.resolve('TINYFISH_API_KEY').then((cred) => cred?.value),
    baseURL: config.baseURL,
    maxResults: config.maxResults,
  }))

  // Register an HTTP test endpoint when webServer is available (browser UI test button)
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(() => {
      return httpCtx.webServer.register({
        kind: 'exact',
        path: '/api/tinyfish/test',
        handler: async (req, res) => {
          if (req.method !== 'POST' && req.method !== 'GET') {
            res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
            return
          }

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
            if (body.length > 65536) req.destroy()
          })

          req.on('end', async () => {
            let candidateKey = ''
            if (body) {
              try {
                const parsed = JSON.parse(body)
                if (typeof parsed.apiKey === 'string' && parsed.apiKey.trim()) {
                  candidateKey = parsed.apiKey.trim()
                }
              } catch {}
            }

            if (!candidateKey) {
              if (config.apiKey) {
                candidateKey = config.apiKey
              } else {
                const cred = await ctx.credentials.resolve('TINYFISH_API_KEY')
                if (cred && cred.value) {
                  candidateKey = cred.value
                }
              }
            }

            if (!candidateKey) {
              res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({
                ok: false,
                error: '未检测到 API Key，请先输入或保存 Key',
              }))
              return
            }

            const start = Date.now()
            const testUrl = new URL(config.baseURL)
            testUrl.searchParams.set('query', 'test')
            try {
              const response = await fetch(testUrl, {
                method: 'GET',
                redirect: 'error',
                headers: {
                  'x-api-key': candidateKey,
                  'accept': 'application/json',
                  'user-agent': USER_AGENT,
                },
              })
              const latencyMs = Date.now() - start

              if (response.ok) {
                let resultCount = 0
                try {
                  const data = await response.json()
                  if (Array.isArray(data?.results)) {
                    resultCount = data.results.length
                  }
                } catch {}
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
                res.end(JSON.stringify({
                  ok: true,
                  latencyMs,
                  count: resultCount,
                  message: `测试成功！TinyFish 搜索正常响应 (${latencyMs}ms，返回 ${resultCount} 条结果)`,
                }))
              } else {
                let detail = `HTTP ${response.status}`
                try {
                  const data = await response.json()
                  detail = data?.detail?.error ?? data?.error?.message ?? data?.detail ?? data?.message ?? detail
                } catch {}
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
                res.end(JSON.stringify({
                  ok: false,
                  status: response.status,
                  latencyMs,
                  error: `TinyFish API 错误 (${response.status}): ${detail}`,
                }))
              }
            } catch (err) {
              const latencyMs = Date.now() - start
              res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({
                ok: false,
                latencyMs,
                error: `连接 TinyFish 失败: ${err.message || String(err)}`,
              }))
            }
          })
        },
      })
    }, 'tinyfish-websearch: test endpoint')
  })
}
