# ESP32 API contract

Version 1 (`/api/v1`). This is the agreement between the ESP32 firmware and this
web application. The frontend is written against exactly this contract, and every
address it uses lives in `src/config/endpoints.ts`.

Status: **proposed**. The endpoints are not implemented on hardware yet. Anything
marked *placeholder* needs sign-off before it is treated as final.

---

## 1. Conventions

### Transport

| | |
|---|---|
| Base URL | the ESP32's own address, normally `http://192.168.4.1` |
| Content type | `application/json; charset=utf-8` |
| Character set | UTF-8 |
| Compression | `Content-Encoding: gzip` is supported and recommended |
| CORS | `Access-Control-Allow-Origin: *` is needed only while the app runs from a laptop dev server. Once the ESP32 serves the app, requests are same-origin and no CORS headers are required. |

### Timestamps

* Every timestamp is **ISO-8601 with an explicit offset**, e.g. `2026-09-29T14:34:07.250Z`.
* Millisecond precision is expected but not required.
* If the ESP32 has no real-time clock, it must still emit a monotonic ISO-8601
  time from an assumed epoch and say so in `GET /api/v1/system` — the app shows
  ages ("12 s ago") derived from these, so they must advance consistently.

### Units

Units are fixed by this contract and are never sent as part of a value.

| Field | Unit |
|---|---|
| `battery.voltageV` | volts (V) |
| `battery.currentA` | amperes (A), **positive = discharge**, negative = charge/regeneration |
| `battery.stateOfChargePercent` | percent (0–100) |
| `phaseCurrentA.phaseA` / `phaseB` / `phaseC` | amperes RMS (A) |
| `inputDuty` | percent (0–100) |
| `temperatureC.inverter` / `mcu` | degrees Celsius (°C) |
| `uptimeSeconds`, `systemUptimeSeconds` | seconds |
| `location.latitude` / `longitude` | decimal degrees, WGS-84 |
| `location.accuracyMeters` | metres, 1-sigma horizontal |
| `location.speedKph` | kilometres per hour |

### Null handling — the important rule

`null` means **"this value is not available"**.

* A missing, failed or not-yet-read signal is `null`.
* It is **never** sent as `0`, `-1`, `999`, `NaN` or an empty string.
* A field that is absent from the JSON is treated exactly like `null`.
* The frontend displays `null` as "—" with the reason beside it, and it is stored
  as a gap in the charts rather than a data point.

Three states are kept apart, and the ESP32 should distinguish them in
`/api/v1/measurements`:

| `quality` | Meaning |
|---|---|
| `valid` | Fresh, trustworthy reading. |
| `stale` | A real reading, but older than the signal's timeout. The value is still sent. |
| `invalid` | A reading arrived but the STM32 flagged it as not trustworthy (out of range, checksum failure). |
| `missing` | No reading at all. `value` and `rawValue` must both be `null`. |

### Error responses

Any non-2xx response uses this body:

```json
{
  "error": {
    "code": "CAN_UNAVAILABLE",
    "message": "No CAN frames have been received from the STM32.",
    "at": "2026-09-29T14:34:07.250Z"
  }
}
```

| HTTP | `error.code` | When |
|---|---|---|
| 200 | — | Normal. Note that a payload full of `null` values is still a 200 — "no data from the STM32" is data. |
| 400 | `BAD_REQUEST` | Malformed query parameter. |
| 404 | `NOT_FOUND` | Unknown route. |
| 503 | `NOT_READY` | ESP32 is still starting up and has no snapshot yet. |
| 503 | `CAN_UNAVAILABLE` | Optional. Prefer a 200 with `communication.canConnected: false`, which the UI handles better. |

The app treats any non-2xx as a communication problem, shows it on the System
Status page, and keeps the WebSocket running.

---

## 2. REST endpoints

### `GET /api/v1/status`

The single snapshot the overview is built from. **Required fields:** every field
below must be present; values may be `null`.

```jsonc
{
  "vehicleId": "TUKTUK-001",          // string, required
  "timestamp": "2026-09-29T14:34:07.250Z", // ISO-8601, required
  "sequenceNumber": 48211,             // integer, increments per frame, wraps at 2^32
  "operatingState": "driving",         // off | starting | ready | driving | limited | fault
  "battery": {
    "voltageV": 74.2,                  // number | null
    "currentA": 38.4,                  // number | null
    "stateOfChargePercent": 78         // number | null
  },
  "phaseCurrentA": {                   // named this way to match the agreed data model
    "phaseA": 59.1,
    "phaseB": 58.7,
    "phaseC": 59.4
  },
  "inputDuty": 46.2,                   // number | null, percent
  "temperatureC": {
    "inverter": 52.4,
    "mcu": 44.1
  },
  "uptimeSeconds": 4821,               // integer, since the STM32 started
  "location": { /* see GET /api/v1/location */ },
  "communication": {
    "stm32Connected": true,            // boolean, required
    "esp32Connected": true,            // boolean, required — always true in a served response
    "canConnected": true,              // boolean, required
    "gnssConnected": true,             // boolean, required
    "lastCanMessageAt": "2026-09-29T14:34:07.180Z", // ISO-8601 | null
    "canReceiveErrorCount": 0,         // integer | null (optional)
    "canBusLoadPercent": 22.4          // number | null (optional)
  },
  "activeFaults": [ /* array of Fault, see below */ ]
}
```

`operatingState`, `communication.*Connected`, and every field of a fault are
**reported by the STM32**. The application displays them; it does not derive them.

### `GET /api/v1/faults`

Currently active faults.

```json
{ "faults": [ /* Fault */ ], "count": 1, "timestamp": "2026-09-29T14:34:07.250Z" }
```

A bare array is also accepted.

#### The `Fault` object

```jsonc
{
  "id": "INV_OVER_TEMP-2026-09-29T14:33:58.100Z", // string, unique for this occurrence
  "code": "INV_OVER_TEMP",           // string, required — see the code list below
  "title": "Inverter temperature is too high",  // optional; the app has a fallback per code
  "description": "…",                 // optional; the app has a fallback per code
  "subsystem": "inverter",            // battery|motor|inverter|mcu|precharge|communication|location|sensor
  "severity": "critical",             // information|warning|critical|emergency
  "status": "active",                 // active|acknowledged|resolved
  "detectedAt": "2026-09-29T14:33:58.100Z",  // ISO-8601, required
  "lastSeenAt": "2026-09-29T14:34:07.180Z",  // ISO-8601, required
  "resolvedAt": null,                 // ISO-8601 | null
  "measuredValue": 95.6,              // number | null — the value that triggered it
  "unit": "°C",                       // string | null
  "warningThreshold": 80,             // number | null
  "criticalThreshold": 95,            // number | null
  "possibleCauses": ["…"],            // string[]; empty is allowed, the app falls back to its catalogue
  "recommendedActions": ["…"],        // string[]; same fallback
  "measurementId": "inverterTemperature", // one of the measurement ids, or null
  "normalRangeMin": -10,              // number | null
  "normalRangeMax": 70,               // number | null
  "vehicleCanContinue": false,        // boolean — STM32's decision
  "requiresImmediateShutdown": true,  // boolean — STM32's decision
  "clearing": "authorized-tool-required", // self-clearing|authorized-tool-required|service-required
  "occurrenceCount": 1                // integer
}
```

**Only `code`, `detectedAt` and `lastSeenAt` are strictly required.** Anything else
missing is filled in from the app's fault catalogue
(`src/services/faultCatalog.ts`). The two safety flags default to the cautious
answer when absent: `vehicleCanContinue: false`, `requiresImmediateShutdown` from
the catalogue.

#### Fault codes

| Code | Subsystem | Default severity |
|---|---|---|
| `BATT_UNDER_VOLT` | battery | warning (critical below the critical limit) |
| `BATT_OVER_CURRENT` | battery | critical |
| `INV_OVER_TEMP` | inverter | critical |
| `MCU_OVER_TEMP` | mcu | warning |
| `PHASE_IMBALANCE` | motor | critical |
| `SENSOR_DISCONNECT` | sensor | warning |
| `CAN_COMM_LOSS` | communication | emergency |
| `GNSS_SIGNAL_LOSS` | location | information |
| `PRECHARGE_TIMEOUT` | precharge | emergency |

An unknown code is still displayed, using whatever `title`, `description`,
`possibleCauses` and `recommendedActions` the device sends.

### `GET /api/v1/faults/history`

Resolved and historical faults, newest first. Same object shape, with
`status: "resolved"` and a non-null `resolvedAt`.

Optional query parameters (the app does not depend on them):
`?limit=50`, `?since=<ISO-8601>`.

### `GET /api/v1/measurements`

Per-signal detail — this is what the Live Data technical view shows.

```jsonc
{
  "timestamp": "2026-09-29T14:34:07.250Z",
  "measurements": {
    "batteryVoltage": {
      "value": 74.2,                  // number | null, engineering units
      "rawValue": 2968,               // number | null, as received on CAN before scaling
      "sampledAt": "2026-09-29T14:34:07.180Z",  // when the STM32 sampled it
      "receivedAt": "2026-09-29T14:34:07.240Z", // when the ESP32 received the frame
      "quality": "valid",             // valid|stale|invalid|missing
      "qualityDetail": null           // string | null — why, when not valid
    }
    // … one entry per measurement id
  }
}
```

Measurement ids: `batteryVoltage`, `batteryCurrent`, `stateOfCharge`, `inputDuty`,
`phaseCurrentA`, `phaseCurrentB`, `phaseCurrentC`, `inverterTemperature`,
`mcuTemperature`.

An id the device omits is treated as `quality: "missing"`.

### `GET /api/v1/system`

```jsonc
{
  "vehicleId": "TUKTUK-001",
  "stm32FirmwareVersion": "1.2.0",     // string | null (null = controller not responding)
  "esp32FirmwareVersion": "0.9.4",     // string | null
  "hotspotSsid": "TukTuk-VCU-001",     // string | null
  "hotspotClients": 1,                 // integer | null
  "lastCanMessageAt": "2026-09-29T14:34:07.180Z", // ISO-8601 | null
  "canReceiveErrorCount": 0,           // integer | null
  "canBusLoadPercent": 22,             // number | null
  "systemUptimeSeconds": 4821,         // integer
  "esp32UptimeSeconds": 4866,          // integer | null
  "components": [
    {
      "id": "can",
      "label": "CAN bus",
      "state": "ok",                   // ok|degraded|fault|offline|unknown
      "explanation": "CAN messages are arriving from the vehicle controller.",
      "detail": null                   // string | null
    }
  ]
}
```

`explanation` is shown to the user **verbatim**, so it must be a plain-language
sentence, not a code. The app supplies its own `appVersion`; anything the device
sends for that is ignored.

### `GET /api/v1/location`

```jsonc
{
  "latitude": -1.28638,        // number | null
  "longitude": 36.81722,       // number | null
  "accuracyMeters": 6.5,       // number | null
  "timestamp": "2026-09-29T14:34:05.000Z", // time of the FIX, not of this response
  "valid": true,               // boolean — required; false means there is no current fix
  "satellitesUsed": 11,        // integer | null
  "speedKph": 24.1             // number | null
}
```

When the fix is lost, keep sending the **last known** coordinates with
`valid: false` and the original `timestamp`. Do not update `timestamp` on a
response that carries no new fix — the app uses its age to decide whether to
label the position as old, and a refreshed timestamp would make an old position
look current.

---

## 3. WebSocket

`ws://<device>/api/v1/stream`

* Text frames, one JSON object per frame.
* The server pushes; the app sends nothing except an optional pong.
* The app reconnects automatically with exponential backoff (1 s → 15 s).
* If nothing arrives for `socketSilenceTimeoutMs` (5 s by default) the app marks
  the link as silent and tells the user the readings are not current.

### Envelope

```json
{ "type": "<message type>", "data": { } }
```

### Message types

| `type` | `data` | Cadence |
|---|---|---|
| `status` | the full `GET /api/v1/status` body, optionally with a `measurements` object attached | 2–5 Hz recommended |
| `measurements` | `{ "timestamp": "…", "measurements": { … } }` | up to 10 Hz, when sending measurements separately from status |
| `system` | the `GET /api/v1/system` body | on change, or every 5–10 s |
| `fault.new` | one `Fault` | when the STM32 raises a fault |
| `fault.updated` | one `Fault` | when severity, `measuredValue` or `lastSeenAt` changes materially |
| `fault.resolved` | one `Fault` with `status: "resolved"` and `resolvedAt` set | when the STM32 clears a fault |
| `connection` | `{ "stm32Connected": …, "canConnected": …, "gnssConnected": …, "lastCanMessageAt": … }` | on change |
| `heartbeat` | `{ "timestamp": "…" }` | every 1–2 s when nothing else is being sent |

A `status` frame is enough on its own — a firmware that only implements `status`
works with the whole app. The other types reduce traffic and make notifications
appear sooner.

Notes:

* `fault.new` should be sent **once** per occurrence. The app also de-duplicates,
  but repeating it wastes bandwidth.
* A frame the app cannot parse raises a visible communication error and is
  otherwise ignored; the connection is not dropped.
* Unknown `type` values are ignored, so new message types can be added safely.

---

## 4. Minimum viable firmware

To bring the app up against real hardware, implement in this order:

1. `GET /api/v1/status` — the whole app renders from this.
2. `WS /api/v1/stream` sending `status` frames — everything becomes live.
3. `GET /api/v1/system` — the System Status page fills in.
4. `GET /api/v1/measurements` — the Live Data technical view fills in.
5. `GET /api/v1/faults` and `/faults/history` — fault history survives a reload.
6. `GET /api/v1/location` — only needed if location is polled separately.

---

## 5. What the app never sends

There are no `POST`, `PUT` or `DELETE` routes in this contract, by design.

The application cannot command the vehicle: no acceleration, braking, steering,
direction change, contactor operation or motor control, and no fault clearing.
Acknowledging a fault happens only in the browser and is never sent to the
device. Firmware should reject any write to `/api/v1/*` with `405`.
