# Sample payloads

Six worked examples of what the ESP32 sends, one per situation the interface has
to handle. They are written against `../API_CONTRACT.md`.

| File | Situation |
|---|---|
| `01-normal-operation.json` | Everything reporting, no faults. |
| `02-warning-low-battery.json` | Warning: pack voltage below its normal range. |
| `03-critical-inverter-overheat.json` | Critical: inverter above its approved temperature. |
| `04-missing-sensor-data.json` | One sensor not responding — its value is `null`, never `0`. |
| `05-can-disconnected.json` | ESP32 reachable, but no CAN frames from the STM32. |
| `06-gnss-unavailable.json` | No GNSS fix; last known position kept and labelled as old. |

Every file has the same shape:

```jsonc
{
  "description": "…",
  "whatTheAppDoes": "…",          // what you should see on screen for this payload
  "endpoints": {
    "GET /api/v1/status": { },     // the exact REST body
    "GET /api/v1/measurements": { }
  },
  "websocketFrames": [ ]           // the frames that would carry the same change
}
```

**All values are simulated.** They are shaped to be realistic for a 72 V tuk-tuk,
but no number here has been measured on a vehicle, and every threshold they sit
against is a placeholder awaiting approval.

## Using them against the firmware

Return the `endpoints` bodies verbatim from a stub HTTP server and point the app
at it:

```bash
VITE_DATA_SOURCE=live VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

The app renders each of these without any code change. That is the quickest way
to check a firmware change against the contract before the hardware is wired up.
