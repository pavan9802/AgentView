export type ModelPricing = {
  input: number;       // $ per token
  output: number;      // $ per token
  cacheWrite: number;  // $ per token
  cacheRead: number;   // $ per token
};

// All rates are $ per token (divide published $/M rates by 1_000_000).
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Claude Opus 4.6 ────────────────────────────────────────────────────────
  "claude-opus-4-6": {
    input:      15e-6,
    output:     75e-6,
    cacheWrite: 18.75e-6,
    cacheRead:  1.5e-6,
  },

  // ── Claude Sonnet 4.6 ──────────────────────────────────────────────────────
  "claude-sonnet-4-6": {
    input:      3e-6,
    output:     15e-6,
    cacheWrite: 3.75e-6,
    cacheRead:  0.3e-6,
  },

  // ── Claude Haiku 4.5 ───────────────────────────────────────────────────────
  // Both the short form and the dated form are present so that an exact match
  // is found regardless of which key Claude Code surfaces (B4 fix).
  "claude-haiku-4-5": {
    input:      1e-6,
    output:     5e-6,
    cacheWrite: 1.25e-6,
    cacheRead:  0.1e-6,
  },
  "claude-haiku-4-5-20251001": {
    input:      1e-6,
    output:     5e-6,
    cacheWrite: 1.25e-6,
    cacheRead:  0.1e-6,
  },
};

const FALLBACK = MODEL_PRICING["claude-sonnet-4-6"] as ModelPricing;

/**
 * Returns the pricing for a model string.
 *
 * Resolution order:
 *   1. Exact key match (e.g. "claude-haiku-4-5")
 *   2. Prefix match — a key is a prefix of the model string
 *      (e.g. "claude-sonnet-4-6-20251015" → Sonnet rates)
 *   3. Sonnet 4.6 as the fallback default
 */
export function getPricing(model: string | undefined): ModelPricing {
  if (!model) return FALLBACK;

  const exact = MODEL_PRICING[model];
  if (exact) return exact;

  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key)) return pricing;
  }

  return FALLBACK;
}
