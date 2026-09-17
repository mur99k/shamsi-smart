import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/decision";

/**
 * GET /api/health — liveness + AI wiring flag.
 * Never calls the AI model; aiConfigured is a boolean only
 * (the key itself is never exposed).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    aiConfigured: aiConfigured(),
    service: "solar-ai-prototype",
    mode: "simulation-only",
  });
}
