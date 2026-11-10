/**
 * Core data model shared by the mock service, the live ESP32 service and the UI.
 *
 * Rule that applies everywhere in this file:
 *   `null` means "we do not have this value".
 *   It is never replaced with 0 and never silently rendered as 0.
 */

export type OperatingState =
  | 'off'
  | 'starting'
  | 'ready'
  | 'driving'
  | 'limited'
  | 'fault';

export type Subsystem =
  | 'battery'
  | 'motor'
  | 'inverter'
  | 'mcu'
  | 'precharge'
  | 'communication'
  | 'location'
  | 'sensor';

export type Severity = 'information' | 'warning' | 'critical' | 'emergency';

export type FaultStatus = 'active' | 'acknowledged' | 'resolved';

/** Presentation-level roll-up. See `deriveOverallStatus` for exactly how it is produced. */
export type OverallStatus = 'normal' | 'warning' | 'critical' | 'offline';

/** Quality of a single measurement. Missing, stale and invalid are distinct states. */
export type MeasurementQuality = 'valid' | 'stale' | 'invalid' | 'missing';

export interface BatteryReadings {
  voltageV: number | null;
  currentA: number | null;
  stateOfChargePercent: number | null;
}

export interface PhaseCurrentReadings {
  phaseA: number | null;
  phaseB: number | null;
  phaseC: number | null;
}

export interface TemperatureReadings {
  inverter: number | null;
  mcu: number | null;
}

export interface VehicleLocation {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  /** ISO-8601 timestamp of the fix itself, not of the message that carried it. */
  timestamp: string | null;
  /** Reported by the GNSS module through the STM32. The app never infers this. */
  valid: boolean;
  satellitesUsed?: number | null;
  speedKph?: number | null;
}

export interface CommunicationStatus {
  stm32Connected: boolean;
  esp32Connected: boolean;
  canConnected: boolean;
  gnssConnected: boolean;
  lastCanMessageAt: string | null;
  canReceiveErrorCount?: number | null;
  canBusLoadPercent?: number | null;
}

export interface VehicleFault {
  id: string;
  code: string;
  title: string;
  description: string;
  subsystem: Subsystem;
  severity: Severity;
  status: FaultStatus;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  measuredValue: number | null;
  unit: string | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  possibleCauses: string[];
  recommendedActions: string[];

  /* --- Fields beyond the minimum model, all reported by the STM32 --- */

  /** Which measurement triggered the fault, so the UI can chart it. */
  measurementId: MeasurementId | null;
  /** Human-readable normal range for the triggering measurement. */
  normalRangeText: string | null;
  normalRangeMin: number | null;
  normalRangeMax: number | null;
  /** Reported by the STM32 — the app does not decide this. */
  vehicleCanContinue: boolean;
  /** Reported by the STM32 — the app does not decide this. */
  requiresImmediateShutdown: boolean;
  /** Whether the fault is clearable at all, and by whom. */
  clearing: FaultClearingPolicy;
  /** How many times the STM32 has seen this fault in the current session. */
  occurrenceCount: number;
  /** Set locally when a technician acknowledges a warning in this app. */
  acknowledgedAt: string | null;
}

export type FaultClearingPolicy =
  /** Clears by itself once the condition goes away. */
  | 'self-clearing'
  /** Can be cleared, but only through an authorised diagnostic session. */
  | 'authorized-tool-required'
  /** Latched by the STM32; needs a service procedure and a power cycle. */
  | 'service-required';

export interface VehicleStatus {
  vehicleId: string;
  /** ISO-8601, produced by the ESP32 when the frame was assembled. */
  timestamp: string;
  sequenceNumber: number;
  operatingState: OperatingState;
  battery: BatteryReadings;
  phaseCurrentA: PhaseCurrentReadings;
  inputDuty: number | null;
  temperatureC: TemperatureReadings;
  uptimeSeconds: number;
  location: VehicleLocation;
  communication: CommunicationStatus;
  activeFaults: VehicleFault[];
}

/* ------------------------------------------------------------------ */
/* Measurements                                                        */
/* ------------------------------------------------------------------ */

export type MeasurementId =
  | 'batteryVoltage'
  | 'batteryCurrent'
  | 'stateOfCharge'
  | 'inputDuty'
  | 'phaseCurrentA'
  | 'phaseCurrentB'
  | 'phaseCurrentC'
  | 'inverterTemperature'
  | 'mcuTemperature';

/** One live measurement with everything the technical view needs. */
export interface MeasurementSample {
  id: MeasurementId;
  /** Scaled engineering value, or null when unavailable. */
  value: number | null;
  /** Value exactly as it came off the CAN frame, before scaling. */
  rawValue: number | null;
  /** ISO-8601 time the STM32 sampled the signal. */
  sampledAt: string | null;
  /** ISO-8601 time the ESP32 received the carrying frame. */
  receivedAt: string | null;
  quality: MeasurementQuality;
  /** Present when quality is 'invalid' or 'missing'. */
  qualityDetail?: string | null;
}

export type MeasurementSnapshot = Record<MeasurementId, MeasurementSample>;

/* ------------------------------------------------------------------ */
/* System / connection                                                 */
/* ------------------------------------------------------------------ */

export type ComponentState = 'ok' | 'degraded' | 'fault' | 'offline' | 'unknown';

export interface SystemComponent {
  id: string;
  label: string;
  state: ComponentState;
  /** Plain-language sentence shown directly to the user. */
  explanation: string;
  detail?: string | null;
}

export interface SystemInfo {
  vehicleId: string;
  appVersion: string;
  stm32FirmwareVersion: string | null;
  esp32FirmwareVersion: string | null;
  hotspotSsid: string | null;
  hotspotClients: number | null;
  lastCanMessageAt: string | null;
  canReceiveErrorCount: number | null;
  canBusLoadPercent: number | null;
  systemUptimeSeconds: number;
  esp32UptimeSeconds: number | null;
  /** True whenever the data on screen came from the mock service. */
  simulated: boolean;
  components: SystemComponent[];
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/** One point in a charted series. */
export interface HistoryPoint {
  /** Epoch milliseconds — Recharts needs a number for a numeric x-axis. */
  t: number;
  /** null is kept as null so the line breaks instead of dropping to zero. */
  v: number | null;
}

/** A fault occurrence marked on a chart. */
export interface FaultMarker {
  t: number;
  code: string;
  severity: Severity;
  title: string;
  faultId: string;
  /** The measurement the fault was raised against, so it is only marked on that chart. */
  measurementId: MeasurementId | null;
}
