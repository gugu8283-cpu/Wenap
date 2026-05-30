/**
 * OpenRouter chat with timeout, retry, and model fallback chain.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Default per-request timeout (ms). 0 = no timeout. Main analysis passes a higher value from server. */
function defaultTimeoutMs() {
  const raw = String(process.env.OPENROUTER_TIMEOUT_MS || '').trim();
  const n = Number.parseInt(raw, 10);
  if (raw === '0') return 0;
  if (Number.isFinite(n) && n > 0) return Math.min(n, 600_000);
  return 180_000;
}
const OPENROUTER_RETRY_DELAY_MS = 3_000;
const RETRYABLE_HTTP = new Set([429, 500, 502, 503]);

const FALLBACK_MODELS = ['anthropic/claude-haiku-4-5'];

const USER_UNAVAILABLE_MSG =
  'Our analysis engine is temporarily unavailable. Please try again in a few minutes.';

class OpenRouterUnavailableError extends Error {
  constructor(message = USER_UNAVAILABLE_MSG) {
    super(message);
    this.name = 'OpenRouterUnavailableError';
    this.code = 'OPENROUTER_UNAVAILABLE';
    this.userMessage = message;
  }
}

function logFallbackEvent(event, detail) {
  const ts = new Date().toISOString();
  console.warn(`[Wenap] OpenRouter ${event} @ ${ts} ${detail}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildModelChain(primaryModel, extraFallbacks) {
  const chain = [];
  const add = (m) => {
    const s = String(m || '').trim();
    if (s && !chain.includes(s)) chain.push(s);
  };
  add(primaryModel);
  if (Array.isArray(extraFallbacks) && extraFallbacks.length) {
    for (const m of extraFallbacks) add(m);
    return chain;
  }
  for (const m of FALLBACK_MODELS) add(m);
  return chain;
}

function isRetryableError(err, httpStatus) {
  if (httpStatus != null && RETRYABLE_HTTP.has(httpStatus)) return true;
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|fetch failed/i.test(String(err.message || ''));
}

function buildRequestBody({ model, userContent, stream, useWeb, maxOutputTokens }) {
  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
    stream: Boolean(stream),
    temperature: 0.25,
  };
  if (useWeb) body.plugins = [{ id: 'web' }];
  const cap =
    maxOutputTokens != null && Number.isFinite(maxOutputTokens) && maxOutputTokens >= 256
      ? Math.floor(maxOutputTokens)
      : null;
  if (cap) body.max_tokens = cap;
  return body;
}

async function fetchOpenRouterOnce(apiKey, body, timeoutMs) {
  const ms =
    timeoutMs != null && Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : defaultTimeoutMs();
  const ac = new AbortController();
  let timer = null;
  if (ms > 0) {
    timer = setTimeout(() => ac.abort(), ms);
  }
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Wenap',
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{ content: string, usage: object|null, modelUsed: string }|Response>}
 */
async function openRouterChatWithFallback(apiKey, options = {}) {
  const {
    model,
    userContent,
    stream = false,
    useWeb = false,
    maxOutputTokens,
    timeoutMs,
    fallbackModels,
  } = options;
  const chain = buildModelChain(model, fallbackModels);
  let lastDetail = '';

  for (let mi = 0; mi < chain.length; mi++) {
    const tryModel = chain[mi];
    const body = buildRequestBody({ model: tryModel, userContent, stream, useWeb, maxOutputTokens });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchOpenRouterOnce(apiKey, body, timeoutMs);
        if (!res.ok) {
          const status = res.status;
          const t = await res.text().catch(() => '');
          lastDetail = `model=${tryModel} status=${status} body=${t.slice(0, 200)}`;
          if (attempt === 0 && isRetryableError(null, status)) {
            logFallbackEvent('retry', `${lastDetail} attempt=1`);
            await sleep(OPENROUTER_RETRY_DELAY_MS);
            continue;
          }
          logFallbackEvent('model_failed', lastDetail);
          break;
        }
        if (stream) {
          logFallbackEvent('success_stream', `model=${tryModel}`);
          return res;
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
        if (mi > 0 || attempt > 0) {
          logFallbackEvent('success_fallback', `model=${tryModel} attempt=${attempt + 1}`);
        }
        return { content, usage, modelUsed: tryModel };
      } catch (e) {
        lastDetail = `model=${tryModel} err=${e?.message || e}`;
        if (attempt === 0 && isRetryableError(e)) {
          logFallbackEvent('retry', `${lastDetail} attempt=1`);
          await sleep(OPENROUTER_RETRY_DELAY_MS);
          continue;
        }
        logFallbackEvent('model_failed', lastDetail);
        break;
      }
    }
    if (mi < chain.length - 1) {
      logFallbackEvent('switch_model', `from=${tryModel} to=${chain[mi + 1]}`);
    }
  }

  logFallbackEvent('all_failed', lastDetail || 'no detail');
  throw new OpenRouterUnavailableError(USER_UNAVAILABLE_MSG);
}

module.exports = {
  OPENROUTER_URL,
  OpenRouterUnavailableError,
  USER_UNAVAILABLE_MSG,
  openRouterChatWithFallback,
};
