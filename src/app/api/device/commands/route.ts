import { NextResponse } from "next/server";

/** Device command channel — the missing half of the ESP32 integration.
 *
 * Flow (works behind NAT, no inbound connection to the device):
 *   1. Dashboard  → POST /api/device/commands   (enqueue a relay change)
 *   2. ESP32      → GET  /api/device/commands?deviceId=…  (poll + consume)
 *
 * SAFETY:
 *  - Only fixed relay ids and on/off states are accepted (no free text).
 *  - Every command expires (default 5 min); devices must ignore stale ones.
 *  - The AI never calls this endpoint — only explicit user action does.
 *
 * LIMITATIONS (prototype): the queue lives in server memory, so it is
 * single-instance only and empty after a redeploy. Durable storage (KV/DB),
 * user authentication on POST, and per-device credentials are the next step.
 */

export const dynamic = "force-dynamic";

const RELAYS = ["battery", "ev", "loads"] as const;
const STATES = ["on", "off"] as const;
const MAX_TTL_MS = 5 * 60 * 1000;
const MAX_QUEUE = 20;

type Relay = (typeof RELAYS)[number];
type State = (typeof STATES)[number];

interface DeviceCommand {
  id: string;
  deviceId: string;
  relay: Relay;
  state: State;
  issuedAt: number;
  expiresAt: number;
  reason?: string;
}

declare global {
  var __solarDeviceCommands: Map<string, DeviceCommand[]> | undefined;
}
if (globalThis.__solarDeviceCommands === undefined) globalThis.__solarDeviceCommands = new Map();

/** When DEVICE_TOKEN is configured, device calls must present it.
 * Unset = open prototype mode (tests, local demos). */
function deviceAuthorized(request: Request): boolean {
  const token = process.env.DEVICE_TOKEN?.trim();
  if (!token) return true;
  return request.headers.get("x-device-token") === token;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.deviceId !== "string" || !body.deviceId.trim()) {
    return NextResponse.json({ error: "INVALID_COMMAND", message: "deviceId is required." }, { status: 400 });
  }
  if (!RELAYS.includes(body.relay as Relay)) {
    return NextResponse.json({ error: "INVALID_COMMAND", message: `relay must be one of: ${RELAYS.join(", ")}.` }, { status: 400 });
  }
  if (!STATES.includes(body.state as State)) {
    return NextResponse.json({ error: "INVALID_COMMAND", message: "state must be 'on' or 'off'." }, { status: 400 });
  }

  const now = Date.now();
  const queue = globalThis.__solarDeviceCommands!.get(body.deviceId) ?? [];
  if (queue.length >= MAX_QUEUE) {
    return NextResponse.json({ error: "QUEUE_FULL", message: "Too many pending commands for this device." }, { status: 429 });
  }
  // An OFF command supersedes any queued ON for the same relay (safety first).
  const pruned = body.state === "off" ? queue.filter((c) => c.relay !== body.relay) : queue;
  const command: DeviceCommand = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    deviceId: body.deviceId,
    relay: body.relay as Relay,
    state: body.state as State,
    issuedAt: now,
    expiresAt: now + MAX_TTL_MS,
    reason: typeof body.reason === "string" ? body.reason.slice(0, 120) : undefined,
  };
  pruned.push(command);
  globalThis.__solarDeviceCommands!.set(body.deviceId, pruned);

  return NextResponse.json({ success: true, queued: { id: command.id, relay: command.relay, state: command.state, expiresAt: command.expiresAt } });
}

export async function GET(request: Request) {
  if (!deviceAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Missing or invalid x-device-token." }, { status: 401 });
  }
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "INVALID_COMMAND", message: "deviceId query parameter is required." }, { status: 400 });
  }

  const now = Date.now();
  const queue = globalThis.__solarDeviceCommands!.get(deviceId) ?? [];
  const fresh = queue.filter((c) => c.expiresAt > now); // drop stale
  globalThis.__solarDeviceCommands!.set(deviceId, []);   // consume

  return NextResponse.json({ success: true, commands: fresh, count: fresh.length });
}

export async function DELETE(request: Request) {
  if (!deviceAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Missing or invalid x-device-token." }, { status: 401 });
  }
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  if (deviceId) globalThis.__solarDeviceCommands!.delete(deviceId);
  return NextResponse.json({ success: true, cleared: deviceId ?? "all" });
}
