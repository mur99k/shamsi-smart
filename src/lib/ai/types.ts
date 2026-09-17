// AI provider surface types (server-side only).
import type { DecisionRequest, RecommendedAction } from "@/types/energy";

export interface RawModelDecision {
  recommendedAction?: unknown;
  reason?: unknown;
  confidence?: unknown;
}

export interface ValidatedModelDecision {
  recommendedAction: RecommendedAction;
  reason: string;
  confidence: number | null;
}

export interface AiProviderResult {
  ok: boolean;
  decision?: ValidatedModelDecision;
  model?: string;
  error?: string;
}

export type { DecisionRequest };
