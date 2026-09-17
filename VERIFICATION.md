# Home, Overview and Fallback Verification

Date: 2026-09-17. Scope: original `solar-app` only. No vault files were written.

## Findings and Implementation

- Before implementation, real Chromium clicks on the existing production preview at port 3100 passed the complete navbar/logo and main/footer link checks for 390px Arabic and 1440px English: 2 tests passed in 1.1 minutes. No blocked or misdirected navigation click was reproduced. No overlay or router defect is claimed.
- Home and Overview previously used the same `DashboardScreen` with a `landing` heading flag and editable controls. This made distinct destinations look nearly identical. It is an information architecture problem observed in source and browser, not proof of a broken click handler.
- Home now introduces the problem/solution with a light conceptual visual and links to all six other pages. Overview shows shared production, consumption, net, surplus, shortage, battery, EV, decision and flow. Simulation edits are available only in Simulator through explicit links. Analysis, motion pause and explanatory disclosures remain available on Overview; none edits simulation inputs.
- The fallback bug was the `excess <= 0` branch: both balanced and deficit states have clamped excess zero. The engine now uses `calculateEnergy`'s signed net. Balanced selects `no_action`; deficit selects `energy_shortage`.
- Positive surplus follows battery (available, positive capacity, below 80%), idle available EV, then available loads with positive capacity. Without an eligible sink, it selects `reduce_solar_input`. Capacity zero cannot charge. The 80% threshold is policy, not physical fullness. No hardware command or residual-power allocation is implemented.
- The chat fallback now names curtailment instead of describing it as holding state. The action label is generic `No Action`; stale balanced-shortage caveats were removed from the active UI and documentation.
- Shared provider lifetime, four route handlers, provider transport, request shapes and response shapes are retained.

## Final Checks

| Check | Actual result |
| --- | --- |
| `npm run lint` | Passed, no warnings/errors |
| `npx tsc --noEmit` | Passed, exit 0 |
| `npm run build` | Passed; seven UI routes and four APIs listed; 14 static/generated entries including framework routes |
| `npx impeccable detect --json src` | `[]` |
| Functional, policy and API Playwright group | 25 passed in 57.4s |
| Navigation 390px AR/EN | 2 passed in 43.9s |
| Navigation 768px AR/EN | 2 passed in 44.5s |
| Navigation 1024px AR/EN | 2 passed in 38.5s |
| Navigation 1440px AR/EN | 2 passed in 33.8s |

Total: **33 distinct tests passed**, in bounded runs against the final production build. Browser executable: `C:\Users\HP\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`.

The navigation matrix checks 7 origins x 7 destinations x 4 widths x 2 languages = **392 primary target clicks**, plus return clicks and every main/footer route link. Mobile menu visibility and closure are asserted. Self-links are clicked without assuming they create a browser history entry.

The rendering matrix checks 56 route/language/width combinations, with no document overflow or uncaught page errors. It saves 24 Home/Overview/Simulator screenshots in `artifacts/gateway-*.png`. Representative Home and Overview screenshots were visually reviewed at 390px Arabic and 1440px English. The screenshot review is representative, not a manual inspection of all 56 combinations.

## Test Corrections and Execution Limits

- The initial navigation harness called `goBack()` after the Project footer linked to the already-current Project page. Same-route navigation correctly did not push a new history entry; the harness returned to an older route. The test now handles self-links. This was not an application navigation failure.
- The first HTTP chat assertion expected `calculated.excessEnergyW`; the existing chat contract is `calculated.excess` (with `net`, `shortage`, `status`). The assertion was corrected, preserving the API.
- Existing tests expecting landing/overview sliders were updated to verify the requested route separation and Simulator editing instead. Existing async, chat, evaluation, motion and recovery checks still run.
- Broad navigation runs hit terminal timeout/child-process tool errors. Those interrupted runs are not counted as passes. The four final width-specific runs above provide complete results.
- Build warns that an unrelated home-directory `package-lock.json` was ignored. Build succeeds; no unrelated configuration was changed.

## Mocked Versus Real

- Mocked browser responses: validated AI decisions, stale/delayed results, chat history and pending replies, errors, and five-case evaluation UI. These establish UI behavior, not model quality.
- Real local logic: eleven fallback cases covering balance, zero/zero, deficit, battery level 79/80/100, unavailable/zero-capacity battery, already-charging EV, loads and curtailment. Each also checks independence from stale supplied excess.
- Real HTTP, no browser response mocks: eleven successful `/api/ai/decision` fallback cases, legacy `/api/decide` balanced response, `/api/ai/chat` fallback including curtailment wording, `/api/health`, and invalid input for decision/chat.
- The isolated production server overrides provider settings with a dummy key, local unreachable URL and test model. It verifies the application's provider-failure path, not a live provider outage or successful remote model call. Real secrets were not read or printed by the agent. Next.js does its normal environment loading; runtime test settings override provider values.
- `scripts/verify-controlled.mjs` checks for a free port, starts its own server, runs the tests, and stops the server. Pre-existing development/preview processes were not stopped.

## Design Review and Constraints

Implementation and application verification were delegated to a general-purpose agent; the parent reviewed the results and coordinated separate vault documentation. Impeccable context, existing PRODUCT/DESIGN, new-work, craft-floor, audit, critique and polish references were consulted by the implementation agent. This is not an independent design certification. Questions were skipped because the user supplied a precise implementation brief and requested execution.

Home has two primary choices with secondary exploration links, without simulation controls or live-looking metrics. Overview retains the established SVG scene, palette, font and components; state text accompanies colors and reduced-motion support remains tested. Detector cleanliness is not a full accessibility certification. Retained secondary diagram labels are small on mobile; no new complete contrast, screen-reader or cross-browser audit is claimed.

State persists across client links only, not refreshes/new tabs. Server decision reasons may remain English in Arabic UI. Evaluation results are route-local. AI results remain validated for schema by existing logic, not forced to equal fallback policy. Charging rates, battery discharge, losses, physical equipment and measured savings remain outside scope.
