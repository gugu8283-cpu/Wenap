/**
 * Google Gemini API (AI Studio key) — direct Gemini, no Vertex / OpenRouter.
 * Key: https://aistudio.google.com/apikey
 */
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch {
  GoogleGenerativeAI = null;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function geminiApiConfigured() {
  if (!GoogleGenerativeAI) return false;
  return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

function geminiPolicyEnabled() {
  const v = String(process.env.GEMINI_POLICY_ENABLED ?? '1')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return geminiApiConfigured();
}

function resolveGeminiModel(override) {
  const raw =
    String(override || '').trim() ||
    String(process.env.GEMINI_POLICY_MODEL || '').trim() ||
    String(process.env.GEMINI_MODEL || '').trim() ||
    DEFAULT_MODEL;
  return raw.replace(/^google\//, '').replace(/^gemini\//, '');
}

function isGeminiSlug(model) {
  const s = String(model || '').trim().toLowerCase();
  if (!s) return false;
  return s.startsWith('google/gemini') || s.startsWith('gemini/') || s.startsWith('gemini-');
}

function usageFromGeminiResponse(response, modelId) {
  const meta = response?.usageMetadata || {};
  const prompt = Number(meta.promptTokenCount) || 0;
  const completion = Number(meta.candidatesTokenCount) || 0;
  const total = Number(meta.totalTokenCount) || prompt + completion;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    model: `gemini/${modelId}`,
  };
}

/**
 * @returns {Promise<{ content: string, usage: object, modelUsed: string }>}
 */
async function geminiApiGenerate({ userContent, maxOutputTokens = 1024, model, useWeb = false } = {}) {
  if (!GoogleGenerativeAI) {
    throw new Error('GEMINI_SDK_MISSING: run npm install @google/generative-ai');
  }
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_NOT_CONFIGURED: set GEMINI_API_KEY');
  }
  const modelId = resolveGeminiModel(model);
  const genAI = new GoogleGenerativeAI(apiKey);
  const baseConfig = {
    model: modelId,
    generationConfig: {
      maxOutputTokens: Math.min(Math.max(maxOutputTokens, 256), 8192),
      temperature: 0.2,
    },
  };
  if (useWeb) {
    baseConfig.tools = [{ googleSearch: {} }];
  }

  async function run(withWeb) {
    const cfg = { ...baseConfig };
    if (!withWeb) delete cfg.tools;
    const generativeModel = genAI.getGenerativeModel(cfg);
    const result = await generativeModel.generateContent(String(userContent || ''));
    const response = result.response;
    const content = typeof response?.text === 'function' ? response.text() : '';
    if (!String(content).trim()) {
      throw new Error('GEMINI_EMPTY_RESPONSE');
    }
    const usage = usageFromGeminiResponse(response, modelId);
    return { content, usage, modelUsed: `gemini/${modelId}` };
  }

  try {
    const out = await run(useWeb);
    console.log(
      `[Wenap] Gemini API generate @ ${new Date().toISOString()} model=${modelId} web=${useWeb ? 1 : 0} tokens=${out.usage.total_tokens}`,
    );
    return out;
  } catch (e) {
    if (useWeb && /googleSearch|tool|grounding|400|404/i.test(String(e.message || ''))) {
      console.warn(`[Wenap] Gemini web search unavailable for ${modelId}, retry without web:`, e.message);
      const out = await run(false);
      console.log(
        `[Wenap] Gemini API generate @ ${new Date().toISOString()} model=${modelId} web=0 tokens=${out.usage.total_tokens}`,
      );
      return out;
    }
    throw e;
  }
}

module.exports = {
  DEFAULT_MODEL,
  geminiApiConfigured,
  geminiPolicyEnabled,
  geminiApiGenerate,
  resolveGeminiModel,
  isGeminiSlug,
};
