/**
 * Provider-neutral LLM client used by all six engines.
 *
 * Configure with environment variables (see .env.example):
 *   AI_PROVIDER   openai | anthropic | groq | gemini | openrouter | together | mistral | deepseek | xai | ollama | custom
 *   AI_API_KEY    the provider's API key (optional for ollama / custom local servers)
 *   AI_MODEL      any model ID the provider serves
 *   AI_BASE_URL   optional; overrides the provider's API base URL (required for "custom")
 *   AI_MAX_TOKENS optional; output-token limit per request
 *   AI_EFFORT     optional; reasoning effort for models that support it (e.g. low | medium | high)
 *   AI_TIMEOUT_MS optional; per-request timeout (default 60000)
 *
 * Every provider except Anthropic is called through the OpenAI-compatible
 * Chat Completions API; Anthropic uses its official SDK (Messages API).
 */
import Anthropic from "@anthropic-ai/sdk";

const PROVIDERS = {
  openai:     { protocol: "openai", baseUrl: "https://api.openai.com/v1", tokenParam: "max_completion_tokens" },
  groq:       { protocol: "openai", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  gemini:     { protocol: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  openrouter: { protocol: "openai", baseUrl: "https://openrouter.ai/api/v1" },
  together:   { protocol: "openai", baseUrl: "https://api.together.xyz/v1" },
  mistral:    { protocol: "openai", baseUrl: "https://api.mistral.ai/v1" },
  deepseek:   { protocol: "openai", baseUrl: "https://api.deepseek.com/v1" },
  xai:        { protocol: "openai", baseUrl: "https://api.x.ai/v1" },
  ollama:     { protocol: "openai", baseUrl: "http://localhost:11434/v1", keyOptional: true },
  custom:     { protocol: "openai", keyOptional: true },
  anthropic:  { protocol: "anthropic" },
};

// Claude models that accept Anthropic's server-side refusal fallback ("fallbacks": "default").
const ANTHROPIC_FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
// Claude models think before answering and the thinking counts against max_tokens, so leave headroom.
const ANTHROPIC_DEFAULT_MAX_TOKENS = 16000;

export const SYSTEM_PROMPT = `You are a compliance adaptation engine that converts
conversational human responses into structured government form data.

Your responsibilities:
- Rewrite legal form fields into simple human questions
- Extract structured data from natural language responses
- Map extracted data into predefined JSON schema fields
- Validate logical consistency across fields
- Identify missing mandatory information
- Recommend required supporting documents
- Generate submission confidence score

Never hallucinate fields not present in schema.
Always return structured JSON output.`;

// ── Configuration ───────────────────────────────────────────────────────

/** Resolve the AI settings from the environment. Read on every call so .env edits apply after restart only. */
export function getAIConfig() {
  const env = process.env;
  // Backwards compatibility: a bare GROQ_API_KEY (the original setup) means provider "groq".
  const provider = (env.AI_PROVIDER || (env.GROQ_API_KEY ? "groq" : "")).trim().toLowerCase();
  const preset = PROVIDERS[provider];
  const apiKey = env.AI_API_KEY || (provider === "groq" ? env.GROQ_API_KEY : "") || "";
  const model = (env.AI_MODEL || preset?.defaultModel || "").trim();
  const baseUrl = (env.AI_BASE_URL || preset?.baseUrl || "").trim().replace(/\/+$/, "");
  const maxTokens = Number(env.AI_MAX_TOKENS) || null;
  const effort = (env.AI_EFFORT || "").trim() || null;
  const timeoutMs = Number(env.AI_TIMEOUT_MS) || 60000;

  let problem = null;
  if (!provider) problem = "AI_PROVIDER is not set";
  else if (!preset) problem = `Unknown AI_PROVIDER "${provider}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`;
  else if (!model) problem = "AI_MODEL is not set";
  else if (!apiKey && !preset.keyOptional) problem = "AI_API_KEY is not set";
  else if (preset.protocol === "openai" && !baseUrl) problem = "AI_BASE_URL is required for the custom provider";

  return {
    provider, model, apiKey, baseUrl, maxTokens, effort, timeoutMs,
    protocol: preset?.protocol,
    tokenParam: preset?.tokenParam ?? "max_tokens",
    customBaseUrl: Boolean(env.AI_BASE_URL),
    enabled: !problem,
    problem,
  };
}

/** Safe summary for logs and the health endpoint (never includes the key). */
export function aiStatus() {
  const { enabled, provider, model, problem } = getAIConfig();
  return { enabled, provider: provider || null, model: model || null, problem };
}

// ── Public API ──────────────────────────────────────────────────────────

/** Send a single-turn chat request to the configured provider and return the reply text. */
export async function chat({ system, prompt, maxTokens = 2048, temperature }) {
  const config = getAIConfig();
  if (!config.enabled) throw new Error(`AI is not configured: ${config.problem}`);

  return config.protocol === "anthropic"
    ? chatAnthropic(config, { system, prompt, maxTokens })
    : chatOpenAICompatible(config, { system, prompt, maxTokens, temperature });
}

/** Engine-facing helper: compliance system prompt, low temperature. `maxTokens` = output budget. */
export function askAI(prompt, { maxTokens = 2048 } = {}) {
  return chat({ system: SYSTEM_PROMPT, prompt, maxTokens, temperature: 0.1 });
}

/**
 * Parse JSON from a model reply. Tolerates markdown fences and prose around the JSON,
 * since models differ in how strictly they follow "return ONLY JSON".
 */
export function parseJSON(raw) {
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch (err) {
    // Fall back to the outermost {...} or [...] in the reply.
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw err;
  }
}

/** Treat null/undefined/"" as an empty answer. */
export function isEmpty(value) {
  return value === null || value === undefined || value === "";
}

// ── OpenAI-compatible providers ─────────────────────────────────────────

async function chatOpenAICompatible(config, { system, prompt, maxTokens, temperature }) {
  const body = {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    [config.tokenParam]: config.maxTokens ?? maxTokens,
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (config.effort) body.reasoning_effort = config.effort;

  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  // Models differ in which parameters they accept; adapt once per kind of rejection.
  const adjusted = new Set();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) return extractOpenAIText(data);

    const message = String(data?.error?.message ?? data?.error ?? data?.message ?? "unknown error");

    if (res.status === 400 && /temperature/i.test(message) && "temperature" in body && !adjusted.has("temperature")) {
      delete body.temperature;
      adjusted.add("temperature");
      continue;
    }
    if (res.status === 400 && /max_tokens/i.test(message) && "max_tokens" in body && !adjusted.has("tokens")) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
      adjusted.add("tokens");
      continue;
    }
    if (res.status === 400 && /reasoning_effort/i.test(message) && "reasoning_effort" in body && !adjusted.has("effort")) {
      delete body.reasoning_effort;
      adjusted.add("effort");
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const wait = Math.min(Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt, 10000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${config.provider} API error ${res.status}: ${message}`);
  }
}

function extractOpenAIText(data) {
  const choice = data?.choices?.[0];
  let content = choice?.message?.content;
  if (Array.isArray(content)) content = content.map((part) => part?.text ?? "").join("");
  // Some open reasoning models (e.g. via Ollama) inline their reasoning in <think> tags.
  const text = String(content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!text) {
    throw new Error(choice?.finish_reason === "length"
      ? "Model ran out of output tokens before answering — raise AI_MAX_TOKENS."
      : "Model returned an empty response.");
  }
  return text;
}

// ── Anthropic (Claude) ──────────────────────────────────────────────────

let anthropicClient;
let anthropicClientKey;

function getAnthropicClient(config) {
  const key = `${config.apiKey}|${config.customBaseUrl ? config.baseUrl : ""}|${config.timeoutMs}`;
  if (anthropicClientKey !== key) {
    anthropicClient = new Anthropic({
      apiKey: config.apiKey,
      ...(config.customBaseUrl && { baseURL: config.baseUrl }),
      timeout: config.timeoutMs,
    });
    anthropicClientKey = key;
  }
  return anthropicClient;
}

async function chatAnthropic(config, { system, prompt, maxTokens }) {
  const client = getAnthropicClient(config);
  // Current Claude models reject sampling parameters, so temperature is not sent.
  const params = {
    model: config.model,
    max_tokens: config.maxTokens ?? Math.max(maxTokens, ANTHROPIC_DEFAULT_MAX_TOKENS),
    system,
    messages: [{ role: "user", content: prompt }],
    ...(config.effort && { output_config: { effort: config.effort } }),
  };

  // On models that support it, let Anthropic re-run a declined request on a fallback model server-side.
  const response = ANTHROPIC_FALLBACK_MODELS.has(config.model) && !config.customBaseUrl
    ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await client.messages.create(params);

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) {
    throw new Error(response.stop_reason === "max_tokens"
      ? "Model ran out of output tokens before answering — raise AI_MAX_TOKENS."
      : "Model returned an empty response.");
  }
  return text;
}
