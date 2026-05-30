/**
 * Route LLM calls: Gemini slugs → Google Gemini API; Anthropic/Haiku → OpenRouter only.
 */
const { geminiApiGenerate, geminiApiConfigured, isGeminiSlug } = require('./geminiApiClient.cjs');
const {
  openRouterChatWithFallback,
  OpenRouterUnavailableError,
} = require('./openRouterClient.cjs');

function buildModelChain(primaryModel, extraFallbacks) {
  const chain = [];
  const add = (m) => {
    const s = String(m || '').trim();
    if (s && !chain.includes(s)) chain.push(s);
  };
  add(primaryModel);
  if (Array.isArray(extraFallbacks)) {
    for (const m of extraFallbacks) add(m);
  }
  return chain;
}

function logRoute(event, detail) {
  console.log(`[Wenap] llmChat ${event} @ ${new Date().toISOString()} ${detail}`);
}

/**
 * @returns {Promise<{ content: string, usage: object|null, modelUsed: string }|Response>}
 */
async function llmChatWithFallback(apiKey, options = {}) {
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
  let lastErr;

  for (let i = 0; i < chain.length; i++) {
    const tryModel = chain[i];
    try {
      if (isGeminiSlug(tryModel)) {
        if (!geminiApiConfigured()) {
          throw new Error('GEMINI_NOT_CONFIGURED: set GEMINI_API_KEY for Gemini models');
        }
        if (i > 0) logRoute('gemini_fallback', `model=${tryModel}`);
        const result = await geminiApiGenerate({
          userContent,
          maxOutputTokens,
          model: tryModel,
          useWeb,
        });
        return result;
      }

      if (i > 0) logRoute('openrouter_fallback', `model=${tryModel}`);
      return await openRouterChatWithFallback(apiKey, {
        model: tryModel,
        userContent,
        stream,
        useWeb,
        maxOutputTokens,
        timeoutMs,
        fallbackModels: [],
      });
    } catch (e) {
      lastErr = e;
      if (i < chain.length - 1) {
        logRoute('try_next', `failed=${tryModel} next=${chain[i + 1]} err=${e?.message || e}`);
      }
    }
  }

  if (lastErr instanceof OpenRouterUnavailableError) throw lastErr;
  throw lastErr || new OpenRouterUnavailableError();
}

module.exports = {
  llmChatWithFallback,
  isGeminiSlug,
};
