# Tuk-Tuk Vehicle Monitor

Monitoring and diagnostic web application for the electric tuk-tuk Vehicle
Control Unit.

A technician connects a phone, tablet or laptop to the vehicle's own Wi-Fi
hotspot, opens the app, and can see what the vehicle is doing and what is wrong
with it — with no internet, no cellular service and no cloud account.

```text
Vehicle sensors and components
  → STM32 main microcontroller        (control, safety logic, fault detection)
  → CAN bus
  → ESP32 connectivity microcontroller (REST + WebSocket, serves this app)
  → Local Wi-Fi hotspot
  → This React application
```

---

## Contents

1. [Install and run](#1-install-and-run)
2. [Mock mode and live mode](#2-mock-mode-and-live-mode)
3. [Demo controls](#3-demo-controls)
4. [The ESP32 endpoints](#4-the-esp32-endpoints)
5. [Building the static files](#5-building-the-static-files)
6. [Hosting the files on the ESP32](#6-hosting-the-files-on-the-esp32)
7. [Project structure](#7-project-structure)
8. [Thresholds — not yet approved](#8-thresholds--not-yet-approved)
9. [Safety boundary](#9-safety-boundary)
10. [Accessibility](#10-accessibility)
11. [Tests](#11-tests)
12. [Remaining hardware-integration steps](#12-remaining-hardware-integration-steps)

---

## 1. Install and run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. It starts in **mock mode**, so it works
immediately with no hardware.

| Command | What it does |
|---|---|
| `npm run dev` | Development server, mock data, hot reload. |
| `npm run build` | Type-check and produce the static files in `dist/`. |
| `npm run preview` | Serve `dist/` locally, exactly as the ESP32 would. |
| `npm run typecheck` | TypeScript only. |
| `npm run lint` | Lint only. |
| `npm run smoke` | Headless test of the simulator and all ten fault scenarios. |
| `npm run render-test` | Renders the real app in jsdom and drives it through the fault flows. |
| `npm run check` | All of the above, in order. |

### Running against a vehicle from a laptop

```bash
# Join the vehicle hotspot first, then:
VITE_API_BASE_URL=http://192.168.4.1 VITE_DATA_SOURCE=live npm run dev
```

---

## 2. Mock mode and live mode

Both data sources implement one interface,
[`VehicleDataService`](src/services/VehicleDataService.ts). No page or component
imports a concrete service — they all go through `useVehicleData()`. Switching
between them changes no UI code.

| | `MockVehicleDataService` | `LiveVehicleDataService` |
|---|---|---|
| Source | generated in the browser | ESP32 REST + WebSocket |
| Needs hardware | no | yes |
| Fault detection | simulates the STM32's debounce and hysteresis | takes what the STM32 reports |
| History on first paint | 15 minutes backfilled | starts empty and fills live |
| Demo controls | yes | no (`simulation` is undefined) |

### Switching

Everything is in **`src/config/endpoints.ts`**, overridable with environment
variables. Copy `.env.example` to `.env.local` and edit it.

```bash
VITE_DATA_SOURCE=mock       # or 'live'
VITE_API_BASE_URL=http://192.168.4.1   # empty = same origin as the page
VITE_SIMULATION_CONTROLS=true
```

**Defaults:** `npm run dev` uses **mock**; `npm run build` uses **live**, because
a production build is the one that gets flashed to the ESP32. To build a demo
bundle that runs on simulated data:

```bash
VITE_DATA_SOURCE=mock VITE_SIMULATION_CONTROLS=true npm run build
```

Writing a third source (a log-file replay, say) means implementing
`VehicleDataService` and adding one line to
[`createVehicleDataService.ts`](src/services/createVehicleDataService.ts).

---

## 3. Demo controls

In mock mode a clearly marked **“Demo controls — simulated data only”** panel sits
collapsed at the bottom of the Overview and System Status pages. It is purple —
a colour used nowhere else — so it is never mistaken for vehicle status.

It can simulate:

| Control | Fault raised |
|---|---|
| Normal operation | none |
| Low battery voltage | `BATT_UNDER_VOLT` |
| Battery overcurrent | `BATT_OVER_CURRENT` |
| Inverter overheating | `INV_OVER_TEMP` |
| Controller overheating | `MCU_OVER_TEMP` |
| Phase-current imbalance | `PHASE_IMBALANCE` |
| Sensor disconnection | `SENSOR_DISCONNECT` |
| CAN communication loss | `CAN_COMM_LOSS` |
| GNSS signal loss | `GNSS_SIGNAL_LOSS` |
| Pre-charge timeout | `PRECHARGE_TIMEOUT` |

Each condition ramps in over several seconds and the fault appears after a short
debounce, the way the STM32 would report it. A “freeze the stream” button holds
the values still while you read them.

The panel renders nothing when `VITE_SIMULATION_CONTROLS=false` (the production
default) or when the live service is in use, so it cannot reach a real vehicle.

---

## 4. The ESP32 endpoints

The full contract — required fields, units, timestamp format, null handling,
error bodies and every WebSocket message — is in
**[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)**, with six worked examples in
[`docs/samples/`](docs/samples/).

```text
GET /api/v1/status           snapshot the overview is built from
GET /api/v1/faults           currently active faults
GET /api/v1/faults/history   resolved faults, newest first
GET /api/v1/measurements     per-signal detail: raw value, quality, timestamps
GET /api/v1/system           versions, uptimes, CAN counters, component states
GET /api/v1/location         position, accuracy, fix validity
WS  /api/v1/stream           live measurements, connection changes, fault events
```

There are no write endpoints, by design (see [Safety boundary](#9-safety-boundary)).

**A firmware that implements only `GET /api/v1/status` renders the whole app.**
The WebSocket makes it live; the rest fill in detail.

Three rules the frontend depends on:

* **`null` means "no value".** Never `0`, never `-1`, never `""`. A missing value
  is drawn as "—" with the reason beside it, and as a gap in the charts.
* **Timestamps are ISO-8601 with an offset.** The app shows ages derived from
  them, so they must advance consistently.
* **A stale GNSS fix keeps its original `timestamp`.** Refreshing it would make
  an old position look current, which the app is built specifically to avoid.

---

## 5. Building the static files

```bash
npm run build
```

`dist/` then contains plain HTML, CSS and JavaScript with no server-side
component:

```text
dist/
  index.html
  favicon.svg
  a/
    index-<hash>.js        app code
    index-<hash>.css       styles
    react-<hash>.js        React + router
    charts-<hash>.js       loaded only on Analysis and fault detail
    map-<hash>.js          loaded only on the Location page
    AnalysisPage-<hash>.js
    LocationPage-<hash>.js
```

Roughly **116 KB gzipped for the first screen**; the chart and map chunks
(another ~150 KB gzipped between them) download only when those pages are
opened.

Three build choices that exist specifically for the ESP32:

* **`base: './'`** — every asset reference is relative, so the files work from
  `/` or from a subdirectory.
* **Hash routing** — `#/faults` rather than `/faults`, so a page reload does not
  need URL rewriting in the firmware.
* **Short paths** (`a/` instead of `assets/`) — SPIFFS limits path length.

---

## 6. Hosting the files on the ESP32

### Pre-compress first

The ESP32 should not gzip at runtime. Compress at build time and serve the `.gz`
with `Content-Encoding: gzip`:

```bash
npm run build
find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
  -exec gzip -9 -k {} \;
```

### Upload

With ESP-IDF, embed `dist/` in a SPIFFS or LittleFS image and flash it to a data
partition. With Arduino, put `dist/` in `data/` and use the filesystem upload
tool. Budget about 1 MB of partition for the compressed build plus room to grow.

### Serving rules

1. `GET /` returns `index.html`.
2. Any unknown path also returns `index.html` — the app is a single page.
3. Files under `a/` are content-hashed, so send
   `Cache-Control: public, max-age=31536000, immutable`.
4. `index.html` must **not** be cached: `Cache-Control: no-cache`.
5. If a `.gz` twin exists, serve it with `Content-Encoding: gzip` and the
   original file's MIME type.
6. `/api/v1/*` is handled before the static fallback.

### Two things that catch people out

* **The clipboard.** Over plain HTTP the browser blocks the clipboard API, so
  “Copy coordinates” falls back to a hidden textarea, and tells the user to copy
  by hand if even that is blocked. Nothing to configure — just do not be
  surprised.
* **Map tiles.** They come from the internet, which the hotspot does not have.
  The Location page detects the failure and swaps in the offline card with the
  coordinates. This is expected behaviour, not a bug.

---

## 7. Project structure

```text
src/
  config/
    endpoints.ts        ← every URL and connection setting, in one file
    thresholds.ts       ← every threshold number, in one file (placeholders)
    measurements.ts     ← the signal catalogue: names, units, CAN ids, timeouts
    navigation.ts
  types/vehicle.ts      ← the shared data model
  services/
    VehicleDataService.ts        interface both services implement
    MockVehicleDataService.ts    the simulator
    LiveVehicleDataService.ts    REST + WebSocket, with input normalisation
    createVehicleDataService.ts  the one switch between them
    faultCatalog.ts              code → plain language, causes, inspection steps
  state/
    VehicleDataProvider.tsx   owns the service, history and derived state
    NotificationProvider.tsx  fault events → in-app notifications
    history.ts                ring buffer + decimation for the charts
  components/
    common/    Card, MetricTile, StatusPill, SeverityIcon, Banner, StateBlock…
    layout/    AppShell, SideNav, BottomNav, ThemeToggle, ConnectionIndicator
    charts/    TimeSeriesChart, ChartCard, chartTheme
    faults/    FaultCard
    location/  VehicleMap, CopyCoordinates
    notifications/ NotificationCenter
  pages/       one file per view
  dev/SimulationPanel.tsx   demo controls, excluded from production builds
  styles/      tokens.css, base.css, layout.css, components.css
docs/
  API_CONTRACT.md
  samples/     six example payloads
scripts/
  smoke.ts        service + scenario tests
  render-test.ts  full-app tests in jsdom
```

---

## 8. Thresholds — not yet approved

**Every threshold in this project is a placeholder.**

They all live in one file, [`src/config/thresholds.ts`](src/config/thresholds.ts),
with a banner saying so. They exist only to draw reference lines in the interface
and to drive the simulator. They have not been reviewed, and the app shows a
“Placeholder values — not yet approved” note wherever they appear.

> **Before these values are used for anything other than UI development they must
> be approved by the electrical team and the project sponsor.**

They are also not what the vehicle acts on. The STM32 holds its own limits and
makes its own decisions; changing a number here changes only what this app draws.

---

## 9. Safety boundary

The application **monitors and reports**. It does not control anything.

The STM32 remains responsible for vehicle control, fault detection, safety
decisions, torque limitation, emergency shutdown and contactor control.

The app therefore:

* displays the operating state and faults the STM32 reports;
* **does not** work out for itself whether the vehicle is safe;
* **cannot** accelerate, brake, steer, change direction, operate contactors or
  command the motor — there are no write endpoints in the contract at all;
* **cannot** clear faults. The fault card names the clearing policy and the
  control is permanently disabled, marked as needing authorised diagnostic
  support.

Two places do arithmetic worth naming explicitly, both presentation-only:

* `displayBand()` colours a reading against the placeholder thresholds so it is
  easy to scan. It never creates a fault and never appears as one.
* `deriveOverallStatus()` rolls the faults the STM32 **has already reported**,
  plus the link state, into one headline word. It reports; it does not judge.

“Acknowledge” is local to the browser. It hides a notification on that device and
is never sent to the vehicle; the fault stays active and stays in the history.

---

## 10. Accessibility

Built to WCAG 2.1 AA.

* **Status is never colour alone.** Every state carries a word and an icon whose
  *shape* differs by severity — circle for information, triangle for
  warning/critical, octagon for emergency — so the four levels are separable in
  greyscale and for anyone who cannot distinguish the colours.
* **Chart colours were validated, not eyeballed.** The three series colours were
  run through a colour-vision validator against both the light and the dark chart
  surface (deuteranopia, protanopia, tritanopia separation plus contrast). Each
  series also has its own dash pattern and is named in the legend, and every
  chart is backed by a current/min/max/average table — so no chart has to be read
  by colour.
* **Units sit beside every number**, and screen-reader text spells them out
  ("74.2 volts", not "74.2 V").
* **Touch targets** are at least 44 px.
* **Keyboard:** skip link, visible 3 px focus ring everywhere, disclosures built
  on `<details>`, filters are real labelled form controls.
* **Live regions:** critical and emergency notifications are `role="alert"`;
  warnings are `role="status"`; result counts announce politely.
* **No dual-axis charts.** Measurements in different units are drawn as separate
  charts sharing a time axis rather than two scales on one plot.
* **Motion:** charts have animation switched off — a real-time line that slides
  on every frame is harder to read — and `prefers-reduced-motion` is honoured.
* **Themes:** follows the device by default, with a manual override that wins in
  both directions. Dark mode is its own palette, not an inverted one.

---

## 11. Tests

```bash
npm run check    # typecheck → lint → smoke → render-test → build
```

**`npm run smoke`** (around 80 checks — the exact count varies because the simulator is not seeded) drives `MockVehicleDataService` through all ten
scenarios and asserts the right fault code appears with causes and inspection
steps, that CAN loss nulls every measurement, that a disconnected sensor gives
`null` rather than `0`, that faults resolve when conditions return to normal,
that staleness is detected from the timestamp, and that the overall status never
reads "normal" while a critical fault stands. Each scenario settles back to normal
first and the suite polls for conditions rather than sleeping a fixed time, so it
is not order-dependent.

**`npm run render-test`** (64 checks) mounts the real application in jsdom and
drives it: it visits all six pages, toggles the technical view, starts the
inverter-overheat scenario from the demo panel, and checks that a critical
notification appears with plain language, the fault code and what to do; that the
fault detail expands with causes and steps; that the clear-fault control is
disabled; that a disconnected sensor shows "—" and not "0.0"; that CAN loss
changes the overview headline; and that a lost GNSS fix is labelled "last known
position" rather than shown as current.

Verified by hand as well: production build output, the dev server, and the
responsive layout — the single-column phone layout with bottom navigation, the
tablet breakpoint at 900 px and the sidebar layout at 1024 px. The only element
wider than the viewport is the live-data table, which sits in a horizontally
scrolling wrapper.

---

## 12. Remaining hardware-integration steps

Nothing in the frontend is waiting on anything. These are the firmware-side
steps:

1. **Agree the CAN signal map.** `src/config/measurements.ts` carries assumed
   frame IDs (`0x120`, `0x121`, `0x130`, `0x131`, `0x140`), scaling factors and
   offsets. Replace them with the real DBC values — the file is the only place
   they appear.
2. **Approve the thresholds.** `src/config/thresholds.ts`, signed off by the
   electrical team and the project sponsor.
3. **Implement `GET /api/v1/status`** on the ESP32. The whole app renders from
   it. Test against `docs/samples/01-normal-operation.json`.
4. **Add `WS /api/v1/stream`** sending `status` frames at 2–5 Hz.
5. **Add the remaining REST endpoints** in the order listed in the contract.
6. **Decide the ESP32's time source.** If there is no RTC, emit a monotonic
   ISO-8601 time from an assumed epoch and say so in `/api/v1/system`.
7. **Check the fault code list** in `src/services/faultCatalog.ts` against what
   the STM32 actually raises, and have a technician review the causes and
   inspection steps for local parts and practice.
8. **Flash the built files** and confirm the serving rules in section 6,
   especially the gzip twins and the single-page fallback.
9. **Retest on the vehicle** with the real hotspot: check stale-data warnings
   appear when CAN is unplugged, that the offline map fallback shows, and that
   the clipboard fallback works over plain HTTP.

### Known limits

* History lives in the browser only, capped at 30 minutes. Closing the app clears
  it. A `GET /api/v1/measurements/history` endpoint would let the Analysis page's
  custom range reach further back; `seedHistory()` on the live service is the
  hook for it.
* Fault acknowledgement is per-device and not persisted across a reload.
* Map tiles need internet. An offline tile pack in ESP32 flash was left out on
  size grounds; the offline coordinate card covers the case instead.

---

## Simulated data

Everything the mock service produces, every sample payload in `docs/samples/`,
and every number in the threshold file is **simulated or provisional**. The app
says so on screen whenever mock data is in use. No value here has been measured
on a vehicle.
