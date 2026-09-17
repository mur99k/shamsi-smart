import { NextResponse } from "next/server";

/** Future ESP32 ingress contract. It validates telemetry but intentionally
 * does not persist or promote readings into the UI until device auth/storage
 * is implemented. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const measurements = body?.measurements as Record<string, unknown> | undefined;
  if (!body || body.schemaVersion !== 1 || typeof body.deviceId !== "string" || typeof body.sequence !== "number" || typeof body.measuredAt !== "string" || body.source !== "hardware" || !measurements) {
    return NextResponse.json({ error: "INVALID_TELEMETRY", message: "Expected schemaVersion, deviceId, sequence, measuredAt, source=hardware and measurements." }, { status: 400 });
  }
  for (const field of ["solarProductionW", "consumptionW"] as const) {
    if (typeof measurements[field] !== "number" || !Number.isFinite(measurements[field])) {
      return NextResponse.json({ error: "INVALID_TELEMETRY", message: `measurements.${field} must be a finite number.` }, { status: 400 });
    }
    if ((measurements[field] as number) < 0) {
      return NextResponse.json({ error: "INVALID_TELEMETRY", message: `measurements.${field} must be >= 0.` }, { status: 400 });
    }
  }
  if (measurements.batteryLevelPercent !== null && (typeof measurements.batteryLevelPercent !== "number" || measurements.batteryLevelPercent < 0 || measurements.batteryLevelPercent > 100)) {
    return NextResponse.json({ error: "INVALID_TELEMETRY", message: "measurements.batteryLevelPercent must be null or between 0 and 100." }, { status: 400 });
  }
  return NextResponse.json({ success: true, accepted: true, mode: "hardware", note: "Telemetry contract validated. Persistence and device authentication are planned." });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "POST /api/telemetry", mode: "planned-ingress" });
}
