/**
 * Vertex AI Gemini — direct Google Cloud API (XPRIZE / no OpenRouter markup).
 * On GCE: uses Application Default Credentials (no JSON key file required).
 */
let VertexAI;
try {
  VertexAI = require('@google-cloud/vertexai').VertexAI;
} catch {
  VertexAI = null;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function vertexGeminiConfigured() {
  if (!VertexAI) return false;
  const project = String(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
  const location = String(process.env.VERTEX_LOCATION || process.env.GCP_REGION || '').trim();
  return Boolean(project && location);
}

function vertexPolicyEnabled() {
  const v = String(process.env.VERTEX_POLICY_ENABLED ?? '1')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return vertexGeminiConfigured();
}

function resolveVertexModel(override) {
  return (
    String(override || '').trim() ||
    String(process.env.VERTEX_GEMINI_MODEL || '').trim() ||
    DEFAULT_MODEL
  );
}

function usageFromVertexResponse(response, modelId) {
  const meta = response?.response?.usageMetadata || response?.usageMetadata || {};
  const prompt = Number(meta.promptTokenCount) || 0;
  const completion = Number(meta.candidatesTokenCount) || 0;
  const total = Number(meta.totalTokenCount) || prompt + completion;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    model: `vertex/${modelId}`,
  };
}

function extractTextFromVertexResponse(response) {
  const candidates = response?.response?.candidates || response?.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  return parts.map((p) => String(p.text || '')).join('');
}

/**
 * @returns {Promise<{ content: string, usage: object, modelUsed: string }>}
 */
async function vertexGeminiGenerate({ userContent, maxOutputTokens = 1024, model } = {}) {
  if (!VertexAI) {
    throw new Error('VERTEX_SDK_MISSING: run npm install @google-cloud/vertexai');
  }
  if (!vertexGeminiConfigured()) {
    throw new Error('VERTEX_NOT_CONFIGURED: set GCP_PROJECT_ID and VERTEX_LOCATION');
  }
  const project = String(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT).trim();
  const location = String(process.env.VERTEX_LOCATION || process.env.GCP_REGION).trim();
  const modelId = resolveVertexModel(model);

  const vertex = new VertexAI({ project, location });
  const generativeModel = vertex.getGenerativeModel({
    model: modelId,
    generationConfig: {
      maxOutputTokens: Math.min(Math.max(maxOutputTokens, 256), 8192),
      temperature: 0.2,
    },
  });

  const result = await generativeModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: String(userContent || '') }] }],
  });

  const content = extractTextFromVertexResponse(result);
  if (!content.trim()) {
    throw new Error('VERTEX_EMPTY_RESPONSE');
  }

  const usage = usageFromVertexResponse(result, modelId);
  console.log(
    `[Wenap] Vertex generate @ ${new Date().toISOString()} model=${modelId} tokens=${usage.total_tokens}`,
  );
  return { content, usage, modelUsed: `vertex/${modelId}` };
}

module.exports = {
  DEFAULT_MODEL,
  vertexGeminiConfigured,
  vertexPolicyEnabled,
  vertexGeminiGenerate,
  resolveVertexModel,
};
