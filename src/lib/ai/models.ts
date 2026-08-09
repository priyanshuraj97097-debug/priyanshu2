/**
 * AI model layer (client-safe).
 * The catalog lives in the database (`ai_models`) so new providers/models can be
 * added without touching application code. This file only holds types plus a
 * fallback used before the catalog loads.
 */
export type AiModel = {
  slug: string;
  provider: string;
  display_name: string;
  description: string | null;
  capabilities: string[];
  context_window: number | null;
  tier: string;
  is_default: boolean;
  sort_order: number;
};

export const FALLBACK_MODELS: AiModel[] = [
  {
    slug: "google/gemini-3.6-flash",
    provider: "google",
    display_name: "Priyanshu Swift",
    description: "Fast everyday reasoning and coding",
    capabilities: ["text", "vision", "files"],
    context_window: 1000000,
    tier: "free",
    is_default: true,
    sort_order: 10,
  },
];

export const DEFAULT_MODEL_SLUG = "google/gemini-3.6-flash";

export type ToolKey = "web_search" | "image_generation" | "code_interpreter";

export const TOOL_REGISTRY: {
  key: ToolKey;
  label: string;
  description: string;
  available: boolean;
}[] = [
  {
    key: "web_search",
    label: "Web search",
    description: "Let the assistant look things up online",
    available: false,
  },
  {
    key: "image_generation",
    label: "Image generation",
    description: "Create images from a description",
    available: false,
  },
  {
    key: "code_interpreter",
    label: "Code interpreter",
    description: "Run and analyse code",
    available: false,
  },
];