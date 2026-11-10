/**
 * The boundary between the user interface and wherever the data comes from.
 *
 * `MockVehicleDataService` and `LiveVehicleDataService` both implement this, and
 * the UI never imports either of them directly — it only ever sees this shape.
 * Swapping one for the other is a single line in `createVehicleDataService.ts`.
 */

import type { DataSourceMode } from '../config/endpoints';
import type {
  HistoryPoint,
  MeasurementId,
  MeasurementSnapshot,
  SystemInfo,
  VehicleFault,
  VehicleLocation,
  VehicleStatus,
} from '../types/vehicle';

/** State of the link between this app and its data source. */
export type LinkState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export interface ConnectionInfo {
  state: LinkState;
  /** ISO time the state was entered. */
  since: string;
  /** ISO time of the most recent message of any kind. */
  lastMessageAt: string | null;
  /** Reconnect attempts since the link was last open. */
  attempt: number;
  /** Address the app is talking to, shown on the System Status page. */
  endpoint: string;
  /** Plain-language description for the user. */
  detail: string;
}

export interface ServiceError {
  scope: 'rest' | 'websocket' | 'parse';
  message: string;
  at: string;
  route?: string;
}

export type VehicleDataEvent =
  | { type: 'status'; status: VehicleStatus; measurements: MeasurementSnapshot }
  | { type: 'measurements'; measurements: MeasurementSnapshot; timestamp: string }
  | { type: 'system'; system: SystemInfo }
  | { type: 'connection'; connection: ConnectionInfo }
  | { type: 'fault:new'; fault: VehicleFault }
  | { type: 'fault:updated'; fault: VehicleFault }
  | { type: 'fault:resolved'; fault: VehicleFault }
  | { type: 'error'; error: ServiceError };

export type VehicleDataListener = (event: VehicleDataEvent) => void;

/* ------------------------------------------------------------------ */
/* Demo / simulation controls — mock service only                      */
/* ------------------------------------------------------------------ */

export type ScenarioId =
  | 'normal'
  | 'lowBatteryVoltage'
  | 'batteryOvercurrent'
  | 'inverterOverheat'
  | 'mcuOverheat'
  | 'phaseImbalance'
  | 'sensorDisconnect'
  | 'canLoss'
  | 'gnssLoss'
  | 'prechargeTimeout';

export interface ScenarioDescriptor {
  id: ScenarioId;
  label: string;
  /** What the technician should expect to see on screen. */
  expectation: string;
  /** Severity the simulated fault will be raised at, for the demo list. */
  severity: 'none' | 'information' | 'warning' | 'critical' | 'emergency';
}

export interface SimulationControls {
  readonly scenarios: ScenarioDescriptor[];
  getScenario(): ScenarioId;
  setScenario(id: ScenarioId): void;
  /** Back to normal operation and clear simulated faults. */
  reset(): void;
  /** Pause the simulated data stream, to freeze a value while reading it. */
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  subscribe(listener: (id: ScenarioId) => void): () => void;
}

/* ------------------------------------------------------------------ */
/* The service itself                                                  */
/* ------------------------------------------------------------------ */

export interface VehicleDataService {
  readonly mode: DataSourceMode;
  /** True whenever the data is generated rather than measured. Shown in the UI. */
  readonly simulated: boolean;
  /** Address the app is talking to, or a description of the mock source. */
  readonly endpoint: string;

  /** Open the stream and load the initial REST payloads. */
  start(): Promise<void>;
  stop(): void;

  subscribe(listener: VehicleDataListener): () => void;

  /* REST-shaped reads. The mock answers these from its own generator. */
  fetchStatus(): Promise<VehicleStatus>;
  fetchFaults(): Promise<VehicleFault[]>;
  fetchFaultHistory(): Promise<VehicleFault[]>;
  fetchMeasurements(): Promise<MeasurementSnapshot>;
  fetchSystemInfo(): Promise<SystemInfo>;
  fetchLocation(): Promise<VehicleLocation>;

  /**
   * Points recorded before the app opened, so the charts are not empty on the
   * first screen. The mock backfills; the live service returns nothing until
   * the ESP32 grows a history endpoint.
   */
  seedHistory(id: MeasurementId): HistoryPoint[];

  /** Present only on the mock service. */
  readonly simulation?: SimulationControls;
}

/** Small typed event emitter shared by both services. */
export class EventBus {
  private listeners = new Set<VehicleDataListener>();

  subscribe(listener: VehicleDataListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: VehicleDataEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('[VehicleDataService] listener threw', error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
