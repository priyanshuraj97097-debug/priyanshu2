/** Client-safe list of assistant modes. Behaviour is applied server-side. */
export type ModeKey =
  | "all_rounder"
  | "deep_thinking"
  | "math"
  | "coding"
  | "writing"
  | "creative"
  | "fast";

export const MODES: { key: ModeKey; label: string; hint: string }[] = [
  { key: "all_rounder", label: "All-Rounder", hint: "Balanced everyday assistant" },
  { key: "deep_thinking", label: "Deep Thinking", hint: "Careful reasoning on hard questions" },
  { key: "math", label: "Math & Complex Problems", hint: "Step-by-step problem solving" },
  { key: "coding", label: "Coding", hint: "Programming, debugging, architecture" },
  { key: "writing", label: "Writing", hint: "Clear, well-structured prose" },
  { key: "creative", label: "Creative", hint: "Ideas, stories, imaginative work" },
  { key: "fast", label: "Fast Answer", hint: "Short, direct answers" },
];

export const DEFAULT_MODE: ModeKey = "all_rounder";

export function isModeKey(value: unknown): value is ModeKey {
  return typeof value === "string" && MODES.some((m) => m.key === value);
}

export function modeLabel(key: string): string {
  return MODES.find((m) => m.key === key)?.label ?? "All-Rounder";
}