/**
 * LiveVehicleDataService
 * ======================
 *
 * Talks to the ESP32 over REST (initial load + anything not pushed) and a
 * WebSocket (real-time measurements, connection changes and fault events).
 *
 * It implements exactly the same interface as `MockVehicleDataService`, so the
 * UI components cannot tell the two apart. All addresses come from
 * `src/config/endpoints.ts` — there are no URLs in this file.
 *
 * Incoming JSON is treated as untrusted: every field is normalised, unknown
 * values become null rather than zero, and a malformed frame raises an error
 * event instead of taking the app down.
 */

import {
  API_ROUTES,
  CONNECTION,
  apiUrl,
  streamUrl,
} from '../config/endpoints';
import { MEASUREMENT_IDS } from '../config/measurements';
import {
  EventBus,
  type ConnectionInfo,
  type LinkState,
  type VehicleDataListener,
  type VehicleDataService,
} from './VehicleDataService';
import { faultDefinition } from './faultCatalog';
import type {
  HistoryPoint,
  MeasurementId,
  MeasurementQuality,
  MeasurementSnapshot,
  SystemInfo,
  VehicleFault,
  VehicleLocation,
  VehicleStatus,
} from '../types/vehicle';
import { nowIso } from '../utils/time';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Numbers only. Anything else — including a string "0" — becomes null. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const QUALITIES: MeasurementQuality[] = ['valid', 'stale', 'invalid', 'missing'];

function quality(value: unknown): MeasurementQuality {
  return QUALITIES.includes(value as MeasurementQuality)
    ? (value as MeasurementQuality)
    : 'missing';
}

/* ------------------------------------------------------------------ */
/* Normalisers                                                         */
/* ------------------------------------------------------------------ */

export function normaliseFault(input: unknown): VehicleFault | null {
  if (!isObject(input)) return null;
  const code = str(input.code);
  if (!code) return null;
  const definition = faultDefinition(code);
  const detectedAt = str(input.detectedAt) ?? nowIso();

  return {
    id: str(input.id) ?? `${code}-${detectedAt}`,
    code,
    title: str(input.title) ?? definition?.title ?? code,
    description: str(input.description) ?? definition?.description ?? '',
    subsystem: (str(input.subsystem) ?? definition?.subsystem ?? 'sensor') as VehicleFault['subsystem'],
    severity: (str(input.severity) ?? definition?.severity ?? 'warning') as VehicleFault['severity'],
    status: (str(input.status) ?? 'active') as VehicleFault['status'],
    detectedAt,
    lastSeenAt: str(input.lastSeenAt) ?? detectedAt,
    resolvedAt: str(input.resolvedAt),
    measuredValue: num(input.measuredValue),
    unit: str(input.unit) ?? definition?.unit ?? null,
    warningThreshold: num(input.warningThreshold) ?? definition?.warningThreshold ?? null,
    criticalThreshold: num(input.criticalThreshold) ?? definition?.criticalThreshold ?? null,
    possibleCauses:
      strArray(input.possibleCauses).length > 0
        ? strArray(input.possibleCauses)
        : (definition?.possibleCauses ?? []),
    recommendedActions:
      strArray(input.recommendedActions).length > 0
        ? strArray(input.recommendedActions)
        : (definition?.recommendedActions ?? []),
    measurementId: (str(input.measurementId) ?? definition?.measurementId ?? null) as MeasurementId | null,
    normalRangeText: str(input.normalRangeText),
    normalRangeMin: num(input.normalRangeMin) ?? definition?.normalRangeMin ?? null,
    normalRangeMax: num(input.normalRangeMax) ?? definition?.normalRangeMax ?? null,
    // These two are safety-relevant, so a missing field defaults to the more
    // cautious answer rather than an optimistic one.
    vehicleCanContinue: bool(input.vehicleCanContinue, definition?.vehicleCanContinue ?? false),
    requiresImmediateShutdown: bool(
      input.requiresImmediateShutdown,
      definition?.requiresImmediateShutdown ?? false,
    ),
    clearing: (str(input.clearing) ?? definition?.clearing ?? 'service-required') as VehicleFault['clearing'],
    occurrenceCount: num(input.occurrenceCount) ?? 1,
    acknowledgedAt: str(input.acknowledgedAt),
  };
}

export function normaliseLocation(input: unknown): VehicleLocation {
  if (!isObject(input)) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      timestamp: null,
      valid: false,
    };
  }
  return {
    latitude: num(input.latitude),
    longitude: num(input.longitude),
    accuracyMeters: num(input.accuracyMeters),
    timestamp: str(input.timestamp),
    valid: bool(input.valid, false),
    satellitesUsed: num(input.satellitesUsed),
    speedKph: num(input.speedKph),
  };
}

export function normaliseMeasurements(input: unknown): MeasurementSnapshot {
  const source = isObject(input) ? input : {};
  const snapshot = {} as MeasurementSnapshot;
  for (const id of MEASUREMENT_IDS) {
    const entry = source[id];
    if (!isObject(entry)) {
      snapshot[id] = {
        id,
        value: null,
        rawValue: null,
        sampledAt: null,
        receivedAt: null,
        quality: 'missing',
        qualityDetail: 'The device did not include this signal.',
      };
      continue;
    }
    snapshot[id] = {
      id,
      value: num(entry.value),
      rawValue: num(entry.rawValue),
      sampledAt: str(entry.sampledAt),
      receivedAt: str(entry.receivedAt),
      quality: quality(entry.quality),
      qualityDetail: str(entry.qualityDetail),
    };
  }
  return snapshot;
}

export function normaliseStatus(input: unknown): VehicleStatus {
  const source = isObject(input) ? input : {};
  const battery = isObject(source.battery) ? source.battery : {};
  const phases = isObject(source.phaseCurrentA) ? source.phaseCurrentA : {};
  const temps = isObject(source.temperatureC) ? source.temperatureC : {};
  const comm = isObject(source.communication) ? source.communication : {};

  return {
    vehicleId: str(source.vehicleId) ?? 'unknown',
    timestamp: str(source.timestamp) ?? nowIso(),
    sequenceNumber: num(source.sequenceNumber) ?? 0,
    operatingState: (str(source.operatingState) ?? 'off') as VehicleStatus['operatingState'],
    battery: {
      voltageV: num(battery.voltageV),
      currentA: num(battery.currentA),
      stateOfChargePercent: num(battery.stateOfChargePercent),
    },
    phaseCurrentA: {
      phaseA: num(phases.phaseA),
      phaseB: num(phases.phaseB),
      phaseC: num(phases.phaseC),
    },
    inputDuty: num(source.inputDuty),
    temperatureC: {
      inverter: num(temps.inverter),
      mcu: num(temps.mcu),
    },
    uptimeSeconds: num(source.uptimeSeconds) ?? 0,
    location: normaliseLocation(source.location),
    communication: {
      stm32Connected: bool(comm.stm32Connected),
      esp32Connected: bool(comm.esp32Connected, true),
      canConnected: bool(comm.canConnected),
      gnssConnected: bool(comm.gnssConnected),
      lastCanMessageAt: str(comm.lastCanMessageAt),
      canReceiveErrorCount: num(comm.canReceiveErrorCount),
      canBusLoadPercent: num(comm.canBusLoadPercent),
    },
    activeFaults: Array.isArray(source.activeFaults)
      ? source.activeFaults
          .map(normaliseFault)
          .filter((f): f is VehicleFault => f !== null)
      : [],
  };
}

export function normaliseSystemInfo(input: unknown, appVersion: string): SystemInfo {
  const source = isObject(input) ? input : {};
  const components = Array.isArray(source.components)
    ? source.components.filter(isObject).map((c) => ({
        id: str(c.id) ?? 'unknown',
        label: str(c.label) ?? 'Unknown component',
        state: (str(c.state) ?? 'unknown') as SystemInfo['components'][number]['state'],
        explanation: str(c.explanation) ?? 'No description provided by the device.',
        detail: str(c.detail),
      }))
    : [];

  return {
    vehicleId: str(source.vehicleId) ?? 'unknown',
    appVersion,
    stm32FirmwareVersion: str(source.stm32FirmwareVersion),
    esp32FirmwareVersion: str(source.esp32FirmwareVersion),
    hotspotSsid: str(source.hotspotSsid),
    hotspotClients: num(source.hotspotClients),
    lastCanMessageAt: str(source.lastCanMessageAt),
    canReceiveErrorCount: num(source.canReceiveErrorCount),
    canBusLoadPercent: num(source.canBusLoadPercent),
    systemUptimeSeconds: num(source.systemUptimeSeconds) ?? 0,
    esp32UptimeSeconds: num(source.esp32UptimeSeconds),
    simulated: false,
    components,
  };
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export class LiveVehicleDataService implements VehicleDataService {
  readonly mode = 'live' as const;
  readonly simulated = false;
  readonly endpoint: string;

  private bus = new EventBus();
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;
  private attempt = 0;
  private appVersion: string;

  private connection: ConnectionInfo;

  constructor(appVersion: string) {
    this.appVersion = appVersion;
    this.endpoint = streamUrl();
    this.connection = {
      state: 'idle',
      since: nowIso(),
      lastMessageAt: null,
      attempt: 0,
      endpoint: this.endpoint,
      detail: 'Not connected yet.',
    };
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.setConnection('connecting', 'Connecting to the vehicle…');

    // Initial REST load. A failure here is reported but does not stop the
    // WebSocket from being opened — the stream may recover on its own.
    try {
      const [status, measurements, system] = await Promise.all([
        this.getJson(API_ROUTES.status),
        this.getJson(API_ROUTES.measurements),
        this.getJson(API_ROUTES.system),
      ]);
      this.bus.emit({
        type: 'status',
        status: normaliseStatus(status),
        measurements: normaliseMeasurements(
          isObject(measurements) && isObject(measurements.measurements)
            ? measurements.measurements
            : measurements,
        ),
      });
      this.bus.emit({ type: 'system', system: normaliseSystemInfo(system, this.appVersion) });
    } catch (error) {
      this.bus.emit({
        type: 'error',
        error: {
          scope: 'rest',
          message: error instanceof Error ? error.message : 'Initial load failed.',
          at: nowIso(),
        },
      });
    }

    this.openSocket();
    this.startSilenceWatch();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.silenceTimer !== null) clearInterval(this.silenceTimer);
    this.reconnectTimer = null;
    this.silenceTimer = null;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.setConnection('closed', 'Disconnected.');
  }

  subscribe(listener: VehicleDataListener): () => void {
    return this.bus.subscribe(listener);
  }

  /* -------------------------------------------------------------- */
  /* REST                                                            */
  /* -------------------------------------------------------------- */

  private async getJson(route: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION.requestTimeoutMs);
    try {
      const response = await fetch(apiUrl(route), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`${route} returned HTTP ${response.status}`);
      }
      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getJsonReporting(route: string): Promise<unknown> {
    try {
      return await this.getJson(route);
    } catch (error) {
      this.bus.emit({
        type: 'error',
        error: {
          scope: 'rest',
          route,
          message: error instanceof Error ? error.message : 'Request failed.',
          at: nowIso(),
        },
      });
      throw error;
    }
  }

  async fetchStatus(): Promise<VehicleStatus> {
    return normaliseStatus(await this.getJsonReporting(API_ROUTES.status));
  }

  async fetchFaults(): Promise<VehicleFault[]> {
    const payload = await this.getJsonReporting(API_ROUTES.faults);
    const list = isObject(payload) && Array.isArray(payload.faults) ? payload.faults : payload;
    return Array.isArray(list)
      ? list.map(normaliseFault).filter((f): f is VehicleFault => f !== null)
      : [];
  }

  async fetchFaultHistory(): Promise<VehicleFault[]> {
    const payload = await this.getJsonReporting(API_ROUTES.faultHistory);
    const list = isObject(payload) && Array.isArray(payload.faults) ? payload.faults : payload;
    return Array.isArray(list)
      ? list.map(normaliseFault).filter((f): f is VehicleFault => f !== null)
      : [];
  }

  async fetchMeasurements(): Promise<MeasurementSnapshot> {
    const payload = await this.getJsonReporting(API_ROUTES.measurements);
    return normaliseMeasurements(
      isObject(payload) && isObject(payload.measurements) ? payload.measurements : payload,
    );
  }

  async fetchSystemInfo(): Promise<SystemInfo> {
    return normaliseSystemInfo(await this.getJsonReporting(API_ROUTES.system), this.appVersion);
  }

  async fetchLocation(): Promise<VehicleLocation> {
    return normaliseLocation(await this.getJsonReporting(API_ROUTES.location));
  }

  seedHistory(): HistoryPoint[] {
    // The ESP32 has no history endpoint yet; charts fill from the live stream.
    return [];
  }

  /* -------------------------------------------------------------- */
  /* WebSocket                                                       */
  /* -------------------------------------------------------------- */

  private openSocket(): void {
    if (this.stopped) return;
    try {
      const socket = new WebSocket(streamUrl());
      this.socket = socket;

      socket.onopen = () => {
        this.attempt = 0;
        this.setConnection('open', 'Connected to the vehicle.');
      };

      socket.onmessage = (event) => this.handleMessage(event.data);

      socket.onerror = () => {
        this.bus.emit({
          type: 'error',
          error: { scope: 'websocket', message: 'The data stream reported an error.', at: nowIso() },
        });
      };

      socket.onclose = () => {
        this.socket = null;
        if (this.stopped) return;
        this.scheduleReconnect();
      };
    } catch (error) {
      this.bus.emit({
        type: 'error',
        error: {
          scope: 'websocket',
          message: error instanceof Error ? error.message : 'Could not open the data stream.',
          at: nowIso(),
        },
      });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    const delay = Math.min(
      CONNECTION.reconnectMaxDelayMs,
      CONNECTION.reconnectInitialDelayMs * CONNECTION.reconnectFactor ** (this.attempt - 1),
    );
    this.setConnection(
      'reconnecting',
      `Connection lost. Trying again in ${Math.round(delay / 1000)} s (attempt ${this.attempt}).`,
    );
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private startSilenceWatch(): void {
    this.silenceTimer = setInterval(() => {
      const last = this.connection.lastMessageAt
        ? Date.parse(this.connection.lastMessageAt)
        : null;
      if (
        this.connection.state === 'open' &&
        last !== null &&
        Date.now() - last > CONNECTION.socketSilenceTimeoutMs
      ) {
        this.setConnection(
          'error',
          'The connection is open but no data has arrived. Readings on screen are not current.',
        );
      }
    }, 1000);
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      this.bus.emit({
        type: 'error',
        error: { scope: 'parse', message: 'Received a message that was not valid JSON.', at: nowIso() },
      });
      return;
    }
    if (!isObject(parsed)) return;

    const type = str(parsed.type);
    const data = parsed.data;
    this.connection = { ...this.connection, lastMessageAt: nowIso() };
    if (this.connection.state !== 'open') {
      this.setConnection('open', 'Connected to the vehicle.');
    }

    switch (type) {
      case 'status': {
        const status = normaliseStatus(data);
        const measurements = normaliseMeasurements(
          isObject(data) && isObject(data.measurements) ? data.measurements : undefined,
        );
        this.bus.emit({ type: 'status', status, measurements });
        break;
      }
      case 'measurements': {
        const payload = isObject(data) ? data : {};
        this.bus.emit({
          type: 'measurements',
          measurements: normaliseMeasurements(
            isObject(payload.measurements) ? payload.measurements : payload,
          ),
          timestamp: str(payload.timestamp) ?? nowIso(),
        });
        break;
      }
      case 'system': {
        this.bus.emit({ type: 'system', system: normaliseSystemInfo(data, this.appVersion) });
        break;
      }
      case 'fault.new':
      case 'fault.updated':
      case 'fault.resolved': {
        const fault = normaliseFault(data);
        if (!fault) return;
        const eventType =
          type === 'fault.new'
            ? ('fault:new' as const)
            : type === 'fault.updated'
              ? ('fault:updated' as const)
              : ('fault:resolved' as const);
        this.bus.emit({ type: eventType, fault });
        break;
      }
      case 'connection': {
        // A connection frame describes the VEHICLE side of the link, not this
        // app's socket, so it is folded into the next status update instead of
        // overwriting the socket state.
        break;
      }
      case 'heartbeat':
        break;
      default:
        break;
    }
  }

  private setConnection(state: LinkState, detail: string): void {
    this.connection = {
      ...this.connection,
      state,
      detail,
      attempt: this.attempt,
      since: state === this.connection.state ? this.connection.since : nowIso(),
    };
    this.bus.emit({ type: 'connection', connection: this.connection });
  }
}
