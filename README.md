# Solar AI / شمسي الذكي

A software simulation prototype for solar surplus management: deterministic energy calculations, structured AI recommendations, and a conversational assistant using the same current system state.

**Simulation only.** No hardware is connected, no physical loads are controlled, and no measured efficiency or financial savings are claimed.

## Run

```sh
npm install
npm run dev
```

The default development URL is `http://localhost:3000`. For an unused port, run `npm run dev -- --port 3100`. Next.js permits only one development process per build directory; do not start a second dev process for this project while one is running. A separate production preview can use `npm run build` followed by `npm run start -- --port 3100`.

Provider configuration remains server-side. Use the existing `.env.example` as a configuration reference. Never expose provider keys through `NEXT_PUBLIC_*`, browser code, logs or documentation. The UX redesign did not inspect `.env.local` or change provider configuration.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product introduction and entry to the simulator or overview |
| `/dashboard` | Current metrics, energy balance and recommendation only |
| `/simulator` | Numeric inputs, ranges, device availability, loads and five scenarios |
| `/assistant` | Full-page conversation and current system context |
| `/evaluation` | Existing five-case API evaluation runner |
| `/project` | Case study, scope and implemented architecture |
| `/hardware` | Explicitly planned sensor, ESP32/Arduino and Raspberry Pi pipeline |

All routes share Arabic/English navigation, RTL/LTR direction and a responsive mobile menu. Home is a concise gateway with a conceptual sunlight/home/storage illustration, primary overview and simulator links, and links to assistant, evaluation, project and hardware. Overview reads the shared simulation with an edit link; all simulation inputs live in the simulator. Its energy-flow destinations disclose explanations, not navigation or hardware actions.

## Shared State

`src/app/layout.tsx` mounts `SolarProvider` above the routed children and `AppShell`. Next.js links preserve the provider during client navigation.

- `SimState`, selected scenario, language, validated decision, conversation and draft survive client-side navigation.
- Reloads, new tabs and full document navigation reset this in-memory state. No local storage or database persistence is provided.
- Numeric input changes update state immediately. Entering `50` updates the power balance to exactly `50 W` without requiring blur or Analyze. Empty input is a temporary edit draft; blur restores the current valid value. Out-of-range input is clamped.
- Editing a value clears the selected scenario and invalidates the previous server decision immediately. Applying a scenario updates all controls.
- Analysis uses an abort controller, a simulation revision and request identity checks. Aborted or superseded responses cannot replace the current state or clear a newer request's loading indicator.
- The initial recommendation is explicitly a local preview. Analysis is user-initiated, with a 45-second UI deadline and visible recovery state. Provider-side timeout and fallback behavior are unchanged.
- The header mode switch defaults to Simulation. In browsers that support Web Serial, Connect ESP32 can open a USB serial port at `115200` and consume newline-delimited JSON readings; receiving a reading invalidates the old decision until the user analyzes the fresh state.

## Conversation

`AIChat` uses provider-owned messages and pending requests, so a reply can finish while the user visits another route. Each request includes a fresh `buildDecisionRequest(sim)` snapshot, the current decision and selected language. Earlier replies retain their original production/consumption/battery snapshot label and are not represented as answers to later edits.

The UI retains at most **40 messages**. Requests send the latest **9 non-error messages**, each capped at **1000 characters**, ending with the current user question. This stays within the unchanged API limit of 10 messages. Full returned reply text remains visible in the retained UI history. Clear conversation is disabled while a request is pending.

Loading, request failure and AI/local reply source are visible. Local preview explanations are translated in the UI; server decision reasons are displayed verbatim and may be English even with Arabic navigation. Chat requests explicitly include `lang`.

## API Contracts and Fallback Policy

 All existing route handlers and their request/response contracts remain unchanged. A separate `POST /api/telemetry` validates a future hardware telemetry envelope but does not persist or promote readings yet. The shared fallback engine now uses computed signed net power; the chat fallback describes curtailment explicitly. The provider transport and AI-first orchestration are unchanged.

```text
SimState -> calculateEnergy -> buildDecisionRequest
  -> POST /api/ai/decision -> validated decision or fallback
  -> POST /api/ai/chat     -> grounded reply or fallback
```

`POST /api/ai/decision` retains `{ success, decision, calculated, source }`. `POST /api/ai/chat` retains `{ success, reply, source, calculated }`. Invalid input retains `400 INVALID_INPUT`. `/api/decide` and `/api/health` are unchanged. `POST /api/telemetry` is a planned-ingress validation endpoint; it currently acknowledges valid envelopes without persistence. The browser never calls the AI provider directly.

```text
netEnergyW      = solarProductionW - consumptionW
excessEnergyW   = max(netEnergyW, 0)
energyShortageW = max(-netEnergyW, 0)
```

The old `excess <= 0` branch incorrectly treated balanced input as shortage because excess is clamped to zero in both states. The corrected deterministic policy is:

1. Negative computed net: `energy_shortage`.
2. Zero computed net: `no_action`, including zero production and zero demand.
3. Positive net: prefer an available battery with capacity greater than zero and level below 80%.
4. Otherwise recommend an available EV that is not already charging.
5. Otherwise recommend available additional loads with positive total capacity.
6. Otherwise recommend `reduce_solar_input`, because no eligible sink can accept the surplus under this policy. This is an advisory curtailment recommendation, never an inverter command.

The 80% boundary is a policy threshold, not a claim that the battery is physically full. This remains a single-action recommendation, not a power-allocation optimizer; it does not simulate charging rates or allocate residual surplus when a selected load's capacity is smaller than the surplus. The generic `No Action` label also supports AI responses without asserting that every such response implies balance.

Energy balance shows actual calculated surplus and uncovered shortage. A suggested destination is highlighted only when surplus is positive. Shortage does not imply battery discharge or active charging. Battery power, transfer losses and time-dependent battery behavior are not simulated.

## Evaluation

The existing runner submits its original five fixed cases sequentially to `/api/ai/decision`. It is independent of the simulator. It reports actual returned actions, source, matching status and response timing. Results reset when leaving the evaluation route. Expected matches are advisory; model confidence is not measured scientific accuracy.

## Verification

Latest verification (2026-09-17): build, lint and `npx tsc --noEmit` passed; Impeccable returned `[]`. All 33 Playwright tests passed in separate bounded runs: 25 functional/policy/API checks and 8 navigation matrices. Each matrix clicks every navbar target and the logo from each of the seven pages, plus every main/footer route link. Both languages were checked at 390, 768, 1024 and 1440px. No navigation click failure was reproduced before or after the implementation. See `VERIFICATION.md` for timings, test corrections, scope and evidence.

Tests used the installed Chromium 1234 executable through the optional environment variable. Live AI-provider success was not tested.

```sh
npm run lint
npx tsc --noEmit
npm run build
npx impeccable detect --json src
# Isolated production server, dummy credentials, controlled provider failure:
node scripts/verify-controlled.mjs tests/fallback.spec.ts tests/ux.spec.ts
node scripts/verify-controlled.mjs tests/navigation.spec.ts -g 390 --workers=1
# Repeat the navigation command with 768, 1024 and 1440.
```

Set `PLAYWRIGHT_BASE_URL` for a different server. An already-installed compatible Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when browser download is unavailable.

`tests/ux.spec.ts` covers direct 50 W entry, shared production/consumption and language, decision invalidation, delayed responses, successful decision persistence, scenario synchronization, zero surplus, bounded chat history and request sizes, pending replies across navigation, recovery states, evaluation rendering, mobile menu behavior and route rendering. All seven routes are checked in AR/EN at all four widths; 24 screenshots of Home, Overview and Simulator are written to ignored `artifacts/gateway-*.png`.

Async decision/chat and evaluation browser tests use controlled browser responses. `tests/fallback.spec.ts` additionally tests real HTTP responses from all four application APIs on an isolated production server. `scripts/verify-controlled.mjs` overrides provider configuration with a dummy key and unreachable local endpoint, starts the server on port 3228 (override with `VERIFY_PORT`), runs Playwright and stops its server. No browser response mocking is used for those HTTP contract checks. They do **not** verify live provider credentials, model quality, real hardware, Safari/Firefox, or complete accessibility conformance.

## Hardware Roadmap

The header mode switch is `Simulation` by default. In browsers with Web Serial support, `Connect ESP32` opens a USB serial port at `115200` and accepts newline-delimited JSON such as `{"solarProductionW":1000,"consumptionW":300,"batteryLevelPercent":40}`. A received reading updates the shared state and invalidates the previous decision so analysis can run against the fresh values. Unsupported browsers remain in simulation mode.

The serial path is a prototype input adapter, not an assertion of connected hardware. `POST /api/telemetry` currently validates a future ESP32 envelope and acknowledges it without persistence. Device authentication, freshness checks, persistence and server-side promotion into shared state are planned.

```text
Current: simulation -> shared system state -> decision / chat
Planned: current & voltage sensors -> ESP32 / Arduino
         -> Raspberry Pi gateway -> validated DecisionRequest -> decision / chat
```

Raspberry Pi is a proposed future gateway, not a deployed integration. Sensor calibration, firmware, transport, authentication, measurement validation, actuator controls and safety interlocks remain unimplemented. Connecting hardware requires engineering and validation, not simply replacing a slider.

## Design Records

`PRODUCT.md` records scope and constraints. `DESIGN.md` records the shipped visual system. Impeccable's new-work, craft-floor, audit, critique and polish guidance was consulted. Review was performed in-thread because this environment has no independent subagent tool; detector results are not a substitute for a separate design or accessibility audit.
