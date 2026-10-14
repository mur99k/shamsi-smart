import { NextResponse } from "next/server";

/** Latest accepted hardware reading (in-memory; single instance only).
 * Serverless platforms may isolate invocations, so production persistence
 * (KV/DB) is still planned. Freshness is always reported honestly. */
interface LatestReading {
  deviceId: string;
  sequence: number;
  measuredAt: string;
  receivedAt: number;
  solarProductionW: number;
  consumptionW: number;
  batteryLevelPercent: number | null;
}

declare global {
  var __solarLatestTelemetry: LatestReading | null | undefined;
}
if (globalThis.__solarLatestTelemetry === undefined) globalThis.__solarLatestTelemetry = null;

/** When DEVICE_TOKEN is configured, devices must present it (x-device-token).
 * Unset = open prototype mode (local demos, tests). The browser GET below
 * stays open because the dashboard reads the latest reading, not the device. */
function deviceAuthorized(request: Request): boolean {
  const token = process.env.DEVICE_TOKEN?.trim();
  if (!token) return true;
  return request.headers.get("x-device-token") === token;
}

/** Future ESP32 ingress contract. It validates telemetry and remembers the
 * latest accepted reading for live display (with reported age). Device
 * authentication and durable persistence are still planned. */
export async function POST(request: Request) {
  if (!deviceAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Missing or invalid x-device-token." }, { status: 401 });
  }
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
  globalThis.__solarLatestTelemetry = {
    deviceId: body.deviceId,
    sequence: body.sequence,
    measuredAt: body.measuredAt,
    receivedAt: Date.now(),
    solarProductionW: measurements.solarProductionW as number,
    consumptionW: measurements.consumptionW as number,
    batteryLevelPercent: measurements.batteryLevelPercent as number | null,
  };
  return NextResponse.json({ success: true, accepted: true, mode: "hardware", note: "Telemetry accepted and remembered as latest reading. Persistence and device authentication are planned." });
}

export async function GET() {
  const latest = globalThis.__solarLatestTelemetry ?? null;
  return NextResponse.json({
    ok: true, endpoint: "POST /api/telemetry", mode: "planned-ingress",
    latest, ageMs: latest ? Date.now() - latest.receivedAt : null,
  });
}
