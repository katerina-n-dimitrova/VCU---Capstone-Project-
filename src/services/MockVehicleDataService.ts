/**
 * MockVehicleDataService
 * ======================
 *
 * Generates a believable stream of vehicle data so the interface can be built
 * and demonstrated with no STM32, no ESP32, no CAN bus and no sensors.
 *
 * EVERYTHING THIS FILE PRODUCES IS SIMULATED. The `simulated` flag is true and
 * the UI shows a banner whenever this service is the source.
 *
 * It deliberately imitates the behaviour of the real pipeline:
 *  - values move continuously rather than jumping
 *  - a fault appears only after a condition has persisted for a few samples,
 *    the way the STM32 would debounce it
 *  - a fault carries the measurement that triggered it
 *  - a fault resolves with hysteresis, not the instant it crosses back
 *  - missing values are null, never zero
 */

import {
  EventBus,
  type ConnectionInfo,
  type ScenarioDescriptor,
  type ScenarioId,
  type SimulationControls,
  type VehicleDataListener,
  type VehicleDataService,
} from './VehicleDataService';
import { buildFault, type FaultCode } from './faultCatalog';
import { MEASUREMENT_IDS, MEASUREMENTS } from '../config/measurements';
import { SYSTEM_LIMITS, THRESHOLDS } from '../config/thresholds';
import { APP_INFO } from '../config/endpoints';
import type {
  ComponentState,
  HistoryPoint,
  MeasurementId,
  MeasurementQuality,
  MeasurementSample,
  MeasurementSnapshot,
  OperatingState,
  Severity,
  SystemComponent,
  SystemInfo,
  VehicleFault,
  VehicleLocation,
  VehicleStatus,
} from '../types/vehicle';
import { nowIso } from '../utils/time';

const TICK_MS = 250;
const SEED_SECONDS = 900; // 15 minutes of backfill so charts open with data
const PACK_CAPACITY_AH = 100;
const PACK_INTERNAL_RESISTANCE_OHM = 0.055;

export const SCENARIOS: ScenarioDescriptor[] = [
  {
    id: 'normal',
    label: 'Normal operation',
    expectation: 'All readings inside their normal range, no active faults.',
    severity: 'none',
  },
  {
    id: 'lowBatteryVoltage',
    label: 'Low battery voltage',
    expectation: 'Pack voltage falls below its normal range and BATT_UNDER_VOLT is raised.',
    severity: 'warning',
  },
  {
    id: 'batteryOvercurrent',
    label: 'Battery overcurrent',
    expectation: 'Pack current climbs past its limit and BATT_OVER_CURRENT is raised.',
    severity: 'critical',
  },
  {
    id: 'inverterOverheat',
    label: 'Inverter overheating',
    expectation: 'Inverter temperature climbs past 95 °C and INV_OVER_TEMP is raised.',
    severity: 'critical',
  },
  {
    id: 'mcuOverheat',
    label: 'Controller overheating',
    expectation: 'Controller board temperature climbs and MCU_OVER_TEMP is raised.',
    severity: 'warning',
  },
  {
    id: 'phaseImbalance',
    label: 'Phase-current imbalance',
    expectation: 'Phase B falls away from A and C and PHASE_IMBALANCE is raised.',
    severity: 'critical',
  },
  {
    id: 'sensorDisconnect',
    label: 'Sensor disconnection',
    expectation:
      'The battery current sensor stops reporting. Its value becomes unavailable — not zero.',
    severity: 'warning',
  },
  {
    id: 'canLoss',
    label: 'CAN communication loss',
    expectation:
      'The ESP32 stops receiving CAN frames. Readings freeze, go stale, then become unavailable.',
    severity: 'emergency',
  },
  {
    id: 'gnssLoss',
    label: 'GNSS signal loss',
    expectation: 'Position stops updating. The last known position is kept and labelled as old.',
    severity: 'information',
  },
  {
    id: 'prechargeTimeout',
    label: 'Pre-charge timeout',
    expectation:
      'Pre-charge does not complete, the drive system stays off and PRECHARGE_TIMEOUT is raised.',
    severity: 'emergency',
  },
];

type DrivePhase = 'idle' | 'accelerate' | 'cruise' | 'coast' | 'brake';

interface EngineValues {
  batteryVoltage: number;
  batteryCurrent: number;
  stateOfCharge: number;
  inputDuty: number;
  phaseCurrentA: number;
  phaseCurrentB: number;
  phaseCurrentC: number;
  inverterTemperature: number;
  mcuTemperature: number;
}

interface FaultTracker {
  consecutive: number;
  fault: VehicleFault | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function approach(current: number, target: number, rate: number): number {
  const delta = target - current;
  return Math.abs(delta) <= rate ? target : current + Math.sign(delta) * rate;
}

/** Deterministic-ish noise that still looks organic. */
function noise(amplitude: number): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

function openCircuitVoltage(soc: number): number {
  return 60 + (clamp(soc, 0, 100) / 100) * 24;
}

function rawFor(id: MeasurementId, value: number): number {
  const { factor, offset } = MEASUREMENTS[id].scaling;
  return Math.round(value / factor - offset);
}

export class MockVehicleDataService implements VehicleDataService {
  readonly mode = 'mock' as const;
  readonly simulated = true;
  readonly endpoint = 'Simulated data (no hardware connected)';

  private bus = new EventBus();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private paused = false;

  private scenario: ScenarioId = 'normal';
  private scenarioStartedAt = Date.now();
  private scenarioListeners = new Set<(id: ScenarioId) => void>();

  private startedAt = Date.now();
  private sequence = 0;
  private drivePhase: DrivePhase = 'cruise';
  private drivePhaseRemainingMs = 6000;
  private targetDuty = 45;

  private values: EngineValues = {
    batteryVoltage: 75.5,
    batteryCurrent: 38,
    stateOfCharge: 78,
    inputDuty: 45,
    phaseCurrentA: 58,
    phaseCurrentB: 57,
    phaseCurrentC: 58,
    inverterTemperature: 48,
    mcuTemperature: 44,
  };

  /** Per-measurement override applied by a scenario. undefined = no override. */
  private overrides: Partial<Record<MeasurementId, number | null>> = {};
  private unavailable = new Set<MeasurementId>();

  private location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    valid: boolean;
    timestamp: string;
    satellitesUsed: number;
    speedKph: number | null;
    heading: number;
  } = {
    latitude: -1.28638,
    longitude: 36.81722,
    accuracyMeters: 6.5,
    valid: true,
    timestamp: nowIso(),
    satellitesUsed: 11,
    speedKph: 24,
    heading: Math.random() * 360,
  };

  private canConnected = true;
  private stm32Connected = true;
  private gnssConnected = true;
  private lastCanMessageAt: string = nowIso();
  private canReceiveErrorCount = 0;
  private operatingState: OperatingState = 'driving';

  private trackers: Record<string, FaultTracker> = {};
  private activeFaults: VehicleFault[] = [];
  private faultHistory: VehicleFault[] = [];

  private history: Record<MeasurementId, HistoryPoint[]>;

  private connection: ConnectionInfo = {
    state: 'idle',
    since: nowIso(),
    lastMessageAt: null,
    attempt: 0,
    endpoint: 'Simulated data (no hardware connected)',
    detail: 'The simulator has not been started yet.',
  };

  constructor() {
    this.history = MEASUREMENT_IDS.reduce(
      (acc, id) => {
        acc[id] = [];
        return acc;
      },
      {} as Record<MeasurementId, HistoryPoint[]>,
    );
    this.seedFaultHistory();
    this.backfillHistory();
  }

  /* -------------------------------------------------------------- */
  /* Lifecycle                                                       */
  /* -------------------------------------------------------------- */

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.setConnection({
      state: 'connecting',
      detail: 'Starting the simulator…',
      attempt: 0,
    });

    // A short delay so the loading state is real rather than a flash.
    await new Promise((resolve) => setTimeout(resolve, 350));

    this.setConnection({
      state: 'open',
      detail: 'Simulated data stream running. No hardware is connected.',
      attempt: 0,
      lastMessageAt: nowIso(),
    });

    this.emitSystem();
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setConnection({ state: 'closed', detail: 'Simulator stopped.', attempt: 0 });
  }

  subscribe(listener: VehicleDataListener): () => void {
    return this.bus.subscribe(listener);
  }

  /* -------------------------------------------------------------- */
  /* REST-shaped reads                                               */
  /* -------------------------------------------------------------- */

  async fetchStatus(): Promise<VehicleStatus> {
    return this.buildStatus();
  }

  async fetchFaults(): Promise<VehicleFault[]> {
    return [...this.activeFaults];
  }

  async fetchFaultHistory(): Promise<VehicleFault[]> {
    return [...this.faultHistory];
  }

  async fetchMeasurements(): Promise<MeasurementSnapshot> {
    return this.buildMeasurements();
  }

  async fetchSystemInfo(): Promise<SystemInfo> {
    return this.buildSystemInfo();
  }

  async fetchLocation(): Promise<VehicleLocation> {
    return this.buildLocation();
  }

  seedHistory(id: MeasurementId): HistoryPoint[] {
    return this.history[id] ?? [];
  }

  /* -------------------------------------------------------------- */
  /* Demo controls                                                   */
  /* -------------------------------------------------------------- */

  readonly simulation: SimulationControls = {
    scenarios: SCENARIOS,
    getScenario: () => this.scenario,
    setScenario: (id: ScenarioId) => this.setScenario(id),
    reset: () => this.setScenario('normal'),
    setPaused: (paused: boolean) => {
      this.paused = paused;
    },
    isPaused: () => this.paused,
    subscribe: (listener: (id: ScenarioId) => void) => {
      this.scenarioListeners.add(listener);
      return () => {
        this.scenarioListeners.delete(listener);
      };
    },
  };

  private setScenario(id: ScenarioId): void {
    if (this.scenario === id) return;
    this.scenario = id;
    this.scenarioStartedAt = Date.now();
    this.overrides = {};
    this.unavailable.clear();

    // Leaving a scenario restores the things the scenario switched off.
    if (id !== 'canLoss') {
      this.canConnected = true;
      this.stm32Connected = true;
    }
    if (id !== 'gnssLoss') {
      this.gnssConnected = true;
      this.location.valid = true;
    }
    if (id !== 'prechargeTimeout') {
      this.operatingState = 'driving';
    }

    for (const listener of this.scenarioListeners) listener(id);
    this.emitSystem();
  }

  /* -------------------------------------------------------------- */
  /* Simulation engine                                               */
  /* -------------------------------------------------------------- */

  private stepDrive(dtMs: number): void {
    this.drivePhaseRemainingMs -= dtMs;
    if (this.drivePhaseRemainingMs <= 0) {
      const phases: DrivePhase[] = ['accelerate', 'cruise', 'coast', 'cruise', 'brake', 'idle'];
      this.drivePhase = phases[Math.floor(Math.random() * phases.length)];
      this.drivePhaseRemainingMs = 3000 + Math.random() * 9000;
      switch (this.drivePhase) {
        case 'accelerate':
          this.targetDuty = 70 + Math.random() * 25;
          break;
        case 'cruise':
          this.targetDuty = 35 + Math.random() * 25;
          break;
        case 'coast':
          this.targetDuty = 8 + Math.random() * 10;
          break;
        case 'brake':
          this.targetDuty = 0;
          break;
        case 'idle':
          this.targetDuty = 0;
          break;
      }
    }
  }

  private stepPhysics(dtMs: number): void {
    const dt = dtMs / 1000;
    const v = this.values;
    // Heat follows the current the vehicle is actually seeing, which includes a
    // scenario override — otherwise a simulated overcurrent would leave the
    // inverter cold, which no technician would believe.
    const effectiveCurrent = Math.abs(this.overrides.batteryCurrent ?? v.batteryCurrent);

    this.stepDrive(dtMs);
    v.inputDuty = clamp(approach(v.inputDuty, this.targetDuty, 55 * dt) + noise(0.4), 0, 100);

    const regenerating = this.drivePhase === 'brake';
    const demand = (v.inputDuty / 100) * 115;
    const targetCurrent = regenerating ? -18 - Math.random() * 20 : demand;
    v.batteryCurrent = approach(v.batteryCurrent, targetCurrent, 90 * dt) + noise(1.1);

    v.stateOfCharge = clamp(
      v.stateOfCharge - (v.batteryCurrent * dt) / (PACK_CAPACITY_AH * 36),
      0,
      100,
    );

    v.batteryVoltage =
      openCircuitVoltage(v.stateOfCharge) -
      v.batteryCurrent * PACK_INTERNAL_RESISTANCE_OHM +
      noise(0.12);

    // Phase currents scale with the DC current; healthy phases track together.
    const phaseMagnitude = Math.abs(v.batteryCurrent) * 1.55;
    v.phaseCurrentA = Math.max(0, phaseMagnitude * (1 + noise(0.012)));
    v.phaseCurrentB = Math.max(0, phaseMagnitude * (1 + noise(0.012)));
    v.phaseCurrentC = Math.max(0, phaseMagnitude * (1 + noise(0.012)));

    // First-order thermal models.
    const ambient = 31;
    const inverterTarget = ambient + 7 + effectiveCurrent * 0.3;
    v.inverterTemperature += ((inverterTarget - v.inverterTemperature) / 55) * dt * 6;
    const mcuTarget = ambient + 9 + effectiveCurrent * 0.07;
    v.mcuTemperature += ((mcuTarget - v.mcuTemperature) / 80) * dt * 6;

    this.stepLocation(dt);
  }

  private stepLocation(dt: number): void {
    if (this.scenario === 'gnssLoss' || this.scenario === 'canLoss') return;
    const speedKph = clamp(this.values.inputDuty * 0.45, 0, 45);
    this.location.speedKph = speedKph;
    this.location.heading = (this.location.heading + noise(6) + 0.4) % 360;
    const metresMoved = (speedKph / 3.6) * dt;
    const rad = (this.location.heading * Math.PI) / 180;
    this.location.latitude += (metresMoved * Math.cos(rad)) / 111_320;
    this.location.longitude +=
      (metresMoved * Math.sin(rad)) /
      (111_320 * Math.cos((this.location.latitude * Math.PI) / 180));
    this.location.accuracyMeters = clamp(4 + Math.random() * 5, 2, 30);
    this.location.satellitesUsed = 9 + Math.floor(Math.random() * 4);
    this.location.timestamp = nowIso();
    this.location.valid = true;
  }

  /** Scenario-specific distortion, applied on top of the base physics. */
  private applyScenario(): void {
    const elapsed = (Date.now() - this.scenarioStartedAt) / 1000;
    const ramp = (seconds: number) => clamp(elapsed / seconds, 0, 1);
    const v = this.values;
    this.overrides = {};

    switch (this.scenario) {
      case 'normal':
        break;

      case 'lowBatteryVoltage': {
        const target = 56.5;
        const base = openCircuitVoltage(v.stateOfCharge) - v.batteryCurrent * 0.055;
        this.overrides.batteryVoltage = base + (target - base) * ramp(12) + noise(0.15);
        this.overrides.stateOfCharge = clamp(12 - ramp(12) * 6, 0, 100);
        break;
      }

      case 'batteryOvercurrent': {
        const target = 196;
        this.overrides.batteryCurrent = v.batteryCurrent + (target - v.batteryCurrent) * ramp(8);
        const magnitude = Math.abs(this.overrides.batteryCurrent ?? 0) * 1.35;
        this.overrides.phaseCurrentA = magnitude * (1 + noise(0.01));
        this.overrides.phaseCurrentB = magnitude * (1 + noise(0.01));
        this.overrides.phaseCurrentC = magnitude * (1 + noise(0.01));
        break;
      }

      case 'inverterOverheat': {
        const target = 99;
        this.overrides.inverterTemperature =
          v.inverterTemperature + (target - v.inverterTemperature) * ramp(15) + noise(0.2);
        break;
      }

      case 'mcuOverheat': {
        const target = 88;
        this.overrides.mcuTemperature =
          v.mcuTemperature + (target - v.mcuTemperature) * ramp(15) + noise(0.2);
        break;
      }

      case 'phaseImbalance': {
        // An imbalance is only measurable while the motor is pulling current,
        // so this scenario holds a realistic load rather than letting the
        // simulated drive cycle coast and hide the fault.
        const held = Math.max(Math.abs(v.batteryCurrent), 45);
        const magnitude = held * 1.55;
        const ramped = ramp(10);
        this.overrides.batteryCurrent = held;
        this.overrides.inputDuty = Math.max(v.inputDuty, 38);
        this.overrides.phaseCurrentA = magnitude * (1 + 0.1 * ramped) * (1 + noise(0.01));
        this.overrides.phaseCurrentB = magnitude * (1 - 0.52 * ramped) * (1 + noise(0.01));
        this.overrides.phaseCurrentC = magnitude * (1 + noise(0.01));
        break;
      }

      case 'sensorDisconnect': {
        // The sensor stops reporting. The value is unavailable — NOT zero.
        this.unavailable.add('batteryCurrent');
        break;
      }

      case 'canLoss': {
        // After a short grace period the bus is declared lost and every
        // STM32-sourced measurement becomes unavailable.
        if (elapsed > 1.5) {
          this.canConnected = false;
          this.stm32Connected = false;
          this.canReceiveErrorCount = Math.min(255, Math.floor(elapsed * 9));
          for (const id of MEASUREMENT_IDS) this.unavailable.add(id);
          this.gnssConnected = false;
          this.location.valid = false;
        }
        break;
      }

      case 'gnssLoss': {
        this.gnssConnected = false;
        this.location.valid = false;
        this.location.satellitesUsed = 0;
        this.location.accuracyMeters = null;
        break;
      }

      case 'prechargeTimeout': {
        this.operatingState = 'fault';
        this.overrides.inputDuty = 0;
        this.overrides.batteryCurrent = 0;
        this.overrides.phaseCurrentA = 0;
        this.overrides.phaseCurrentB = 0;
        this.overrides.phaseCurrentC = 0;
        break;
      }
    }

    if (this.scenario !== 'prechargeTimeout' && this.operatingState !== 'driving') {
      this.operatingState = 'driving';
    }
    if (this.scenario === 'canLoss' && this.canConnected === false) {
      this.operatingState = 'fault';
    }
    if (this.canConnected) {
      this.lastCanMessageAt = nowIso();
    }
  }

  private effective(id: MeasurementId): number | null {
    if (this.unavailable.has(id)) return null;
    const override = this.overrides[id];
    if (override !== undefined) return override;
    return this.values[id as keyof EngineValues] ?? null;
  }

  /* -------------------------------------------------------------- */
  /* Simulated STM32 fault detection                                 */
  /* -------------------------------------------------------------- */

  private track(
    code: FaultCode,
    conditionMet: boolean,
    measuredValue: number | null,
    severityOverride?: Severity,
  ): void {
    const tracker = (this.trackers[code] ??= { consecutive: 0, fault: null });
    const debounceTicks = 6; // ~1.5 s at 4 Hz, like an STM32 debounce

    if (conditionMet) {
      tracker.consecutive = Math.min(tracker.consecutive + 1, debounceTicks + 1);
      if (tracker.consecutive >= debounceTicks) {
        const at = nowIso();
        if (!tracker.fault) {
          const fault = buildFault(code, { detectedAt: at, lastSeenAt: at });
          fault.measuredValue = measuredValue;
          if (severityOverride) fault.severity = severityOverride;
          tracker.fault = fault;
          this.activeFaults = [...this.activeFaults, fault];
          this.bus.emit({ type: 'fault:new', fault });
        } else {
          const previousSeverity = tracker.fault.severity;
          const updated: VehicleFault = {
            ...tracker.fault,
            lastSeenAt: at,
            measuredValue,
            severity: severityOverride ?? tracker.fault.severity,
            occurrenceCount: tracker.fault.occurrenceCount,
          };
          tracker.fault = updated;
          this.activeFaults = this.activeFaults.map((f) => (f.id === updated.id ? updated : f));
          // Only announce an update when something meaningful changed.
          if (previousSeverity !== updated.severity) {
            this.bus.emit({ type: 'fault:updated', fault: updated });
          }
        }
      }
    } else {
      tracker.consecutive = Math.max(0, tracker.consecutive - 1);
      if (tracker.fault && tracker.consecutive === 0) {
        const at = nowIso();
        const resolved: VehicleFault = {
          ...tracker.fault,
          status: 'resolved',
          resolvedAt: at,
          lastSeenAt: tracker.fault.lastSeenAt,
        };
        tracker.fault = null;
        this.activeFaults = this.activeFaults.filter((f) => f.id !== resolved.id);
        this.faultHistory = [resolved, ...this.faultHistory].slice(0, 80);
        this.bus.emit({ type: 'fault:resolved', fault: resolved });
      }
    }
  }

  private evaluateFaults(): void {
    const voltage = this.effective('batteryVoltage');
    const current = this.effective('batteryCurrent');
    const invTemp = this.effective('inverterTemperature');
    const mcuTemp = this.effective('mcuTemperature');
    const phaseA = this.effective('phaseCurrentA');
    const phaseB = this.effective('phaseCurrentB');
    const phaseC = this.effective('phaseCurrentC');

    const canLost = !this.canConnected;
    this.track('CAN_COMM_LOSS', canLost, null);

    // Once the bus is down the STM32 is not reporting anything, so no other
    // measurement-based fault can be raised or cleared.
    if (canLost) {
      this.track('GNSS_SIGNAL_LOSS', !this.gnssConnected, null);
      return;
    }

    this.track(
      'BATT_UNDER_VOLT',
      voltage !== null && voltage < THRESHOLDS.batteryVoltage.warningLow,
      voltage,
      voltage !== null && voltage < THRESHOLDS.batteryVoltage.criticalLow ? 'critical' : 'warning',
    );

    this.track(
      'BATT_OVER_CURRENT',
      current !== null && current > THRESHOLDS.batteryCurrent.warningHigh,
      current,
      current !== null && current > THRESHOLDS.batteryCurrent.criticalHigh
        ? 'critical'
        : 'warning',
    );

    this.track(
      'INV_OVER_TEMP',
      invTemp !== null && invTemp > THRESHOLDS.inverterTemperature.warningHigh,
      invTemp,
      invTemp !== null && invTemp > THRESHOLDS.inverterTemperature.criticalHigh
        ? 'critical'
        : 'warning',
    );

    this.track(
      'MCU_OVER_TEMP',
      mcuTemp !== null && mcuTemp > THRESHOLDS.mcuTemperature.warningHigh,
      mcuTemp,
      mcuTemp !== null && mcuTemp > THRESHOLDS.mcuTemperature.criticalHigh
        ? 'critical'
        : 'warning',
    );

    let imbalancePercent: number | null = null;
    if (phaseA !== null && phaseB !== null && phaseC !== null) {
      const mean = (phaseA + phaseB + phaseC) / 3;
      if (mean > 12) {
        const spread = Math.max(phaseA, phaseB, phaseC) - Math.min(phaseA, phaseB, phaseC);
        imbalancePercent = (spread / mean) * 100;
      }
    }
    this.track(
      'PHASE_IMBALANCE',
      imbalancePercent !== null &&
        imbalancePercent > SYSTEM_LIMITS.phaseImbalanceWarningPercent,
      phaseB,
      imbalancePercent !== null &&
        imbalancePercent > SYSTEM_LIMITS.phaseImbalanceCriticalPercent
        ? 'critical'
        : 'warning',
    );

    this.track('SENSOR_DISCONNECT', this.unavailable.size > 0 && !canLost, null);
    this.track('GNSS_SIGNAL_LOSS', !this.gnssConnected, null);
    this.track('PRECHARGE_TIMEOUT', this.scenario === 'prechargeTimeout', voltage);
  }

  /* -------------------------------------------------------------- */
  /* Snapshot assembly                                               */
  /* -------------------------------------------------------------- */

  private qualityFor(id: MeasurementId): MeasurementQuality {
    if (!this.canConnected) return 'missing';
    if (this.unavailable.has(id)) return 'missing';
    return 'valid';
  }

  private buildMeasurements(): MeasurementSnapshot {
    const at = nowIso();
    const snapshot = {} as MeasurementSnapshot;
    for (const id of MEASUREMENT_IDS) {
      const quality = this.qualityFor(id);
      const value = quality === 'missing' ? null : this.effective(id);
      const rounded =
        value === null ? null : Number(value.toFixed(MEASUREMENTS[id].decimals + 1));
      snapshot[id] = {
        id,
        value: rounded,
        rawValue: rounded === null ? null : rawFor(id, rounded),
        sampledAt: quality === 'missing' ? this.lastCanMessageAt : at,
        receivedAt: quality === 'missing' ? this.lastCanMessageAt : at,
        quality,
        qualityDetail:
          quality === 'missing'
            ? this.canConnected
              ? 'No response from the sensor on this channel.'
              : 'No CAN frames are being received from the STM32.'
            : null,
      } satisfies MeasurementSample;
    }
    return snapshot;
  }

  private buildLocation(): VehicleLocation {
    const hasFix = this.gnssConnected && this.location.valid;
    return {
      latitude: this.location.latitude,
      longitude: this.location.longitude,
      accuracyMeters:
        hasFix && this.location.accuracyMeters !== null
          ? Number(this.location.accuracyMeters.toFixed(1))
          : null,
      timestamp: this.location.timestamp,
      valid: hasFix,
      satellitesUsed: hasFix ? this.location.satellitesUsed : 0,
      speedKph: hasFix ? Number((this.location.speedKph ?? 0).toFixed(1)) : null,
    };
  }

  private buildStatus(): VehicleStatus {
    const m = this.buildMeasurements();
    this.sequence += 1;
    return {
      vehicleId: 'TUKTUK-DEV-001',
      timestamp: nowIso(),
      sequenceNumber: this.sequence,
      operatingState: this.operatingState,
      battery: {
        voltageV: m.batteryVoltage.value,
        currentA: m.batteryCurrent.value,
        stateOfChargePercent:
          m.stateOfCharge.value === null ? null : Math.round(m.stateOfCharge.value),
      },
      phaseCurrentA: {
        phaseA: m.phaseCurrentA.value,
        phaseB: m.phaseCurrentB.value,
        phaseC: m.phaseCurrentC.value,
      },
      inputDuty: m.inputDuty.value,
      temperatureC: {
        inverter: m.inverterTemperature.value,
        mcu: m.mcuTemperature.value,
      },
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      location: this.buildLocation(),
      communication: {
        stm32Connected: this.stm32Connected,
        esp32Connected: true,
        canConnected: this.canConnected,
        gnssConnected: this.gnssConnected,
        lastCanMessageAt: this.lastCanMessageAt,
        canReceiveErrorCount: this.canReceiveErrorCount,
        canBusLoadPercent: this.canConnected ? Number((22 + noise(3)).toFixed(1)) : 0,
      },
      activeFaults: [...this.activeFaults],
    };
  }

  private buildSystemInfo(): SystemInfo {
    const componentState = (ok: boolean, degraded = false): ComponentState =>
      ok ? (degraded ? 'degraded' : 'ok') : 'offline';

    const components: SystemComponent[] = [
      {
        id: 'stm32',
        label: 'STM32 vehicle controller',
        state: componentState(this.stm32Connected),
        explanation: this.stm32Connected
          ? 'The vehicle controller is running and sending data.'
          : 'The vehicle controller is not sending data. Check its power and the CAN wiring.',
      },
      {
        id: 'esp32',
        label: 'ESP32 connectivity board',
        state: 'ok',
        explanation: 'The app is connected to the ESP32.',
        detail: 'Simulated — no ESP32 is present in mock mode.',
      },
      {
        id: 'can',
        label: 'CAN bus',
        state: componentState(this.canConnected),
        explanation: this.canConnected
          ? 'CAN messages are arriving from the vehicle controller.'
          : 'The app is connected to the ESP32, but the ESP32 is not receiving data from the STM32.',
        detail: this.canConnected ? null : `Receive error count: ${this.canReceiveErrorCount}`,
      },
      {
        id: 'sensors',
        label: 'Sensors',
        state:
          this.unavailable.size === 0
            ? 'ok'
            : this.canConnected
              ? 'degraded'
              : 'unknown',
        explanation:
          this.unavailable.size === 0
            ? 'All sensors are reporting.'
            : this.canConnected
              ? 'The battery current sensor is not responding.'
              : 'Sensor state is unknown because there is no data from the vehicle controller.',
      },
      {
        id: 'gnss',
        label: 'GNSS receiver',
        state: this.gnssConnected ? 'ok' : 'degraded',
        explanation: this.gnssConnected
          ? `Position is being updated, using ${this.location.satellitesUsed} satellites.`
          : 'Location is unavailable because the GNSS module does not have a valid signal.',
      },
      {
        id: 'hotspot',
        label: 'Wi-Fi hotspot',
        state: 'ok',
        explanation: 'The device is connected to the vehicle hotspot.',
        detail: 'Simulated — mock mode does not use a hotspot.',
      },
    ];

    return {
      vehicleId: 'TUKTUK-DEV-001',
      appVersion: APP_INFO.version,
      stm32FirmwareVersion: this.stm32Connected ? '0.4.2-sim' : null,
      esp32FirmwareVersion: '0.3.1-sim',
      hotspotSsid: 'TukTuk-VCU-001',
      hotspotClients: 1,
      lastCanMessageAt: this.lastCanMessageAt,
      canReceiveErrorCount: this.canReceiveErrorCount,
      canBusLoadPercent: this.canConnected ? 22 : 0,
      systemUptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      esp32UptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) + 45,
      simulated: true,
      components,
    };
  }

  private emitSystem(): void {
    this.bus.emit({ type: 'system', system: this.buildSystemInfo() });
  }

  private setConnection(patch: Partial<ConnectionInfo>): void {
    this.connection = {
      ...this.connection,
      ...patch,
      since: patch.state && patch.state !== this.connection.state ? nowIso() : this.connection.since,
    };
    this.bus.emit({ type: 'connection', connection: this.connection });
  }

  /* -------------------------------------------------------------- */
  /* Tick                                                            */
  /* -------------------------------------------------------------- */

  private systemTickCounter = 0;

  private tick(): void {
    if (this.paused) return;
    this.stepPhysics(TICK_MS);
    this.applyScenario();
    this.evaluateFaults();

    const status = this.buildStatus();
    const measurements = this.buildMeasurements();

    this.connection = { ...this.connection, lastMessageAt: status.timestamp };
    this.bus.emit({ type: 'status', status, measurements });

    this.systemTickCounter += 1;
    if (this.systemTickCounter % 8 === 0) this.emitSystem();
  }

  /* -------------------------------------------------------------- */
  /* Backfill so charts are not empty on first paint                 */
  /* -------------------------------------------------------------- */

  private backfillHistory(): void {
    const now = Date.now();
    const stepMs = 1000;
    const saved = { ...this.values };
    for (let i = SEED_SECONDS; i > 0; i -= 1) {
      this.stepPhysics(stepMs);
      const t = now - i * stepMs;
      for (const id of MEASUREMENT_IDS) {
        const value = this.values[id as keyof EngineValues];
        this.history[id].push({
          t,
          v: Number(value.toFixed(MEASUREMENTS[id].decimals + 1)),
        });
      }
    }
    // Keep the state-of-charge trace realistic without draining the pack flat
    // during the backfill.
    this.values = { ...saved, stateOfCharge: this.values.stateOfCharge };
    this.location.timestamp = nowIso();
  }

  private seedFaultHistory(): void {
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    const make = (code: FaultCode, detected: number, resolved: number, value: number | null) => {
      const fault = buildFault(code, {
        detectedAt: minutesAgo(detected),
        lastSeenAt: minutesAgo(resolved),
      });
      return {
        ...fault,
        id: `${code}-seed-${detected}`,
        status: 'resolved' as const,
        resolvedAt: minutesAgo(resolved),
        measuredValue: value,
        occurrenceCount: 2,
      };
    };
    this.faultHistory = [
      make('MCU_OVER_TEMP', 96, 88, 79.4),
      make('GNSS_SIGNAL_LOSS', 212, 205, null),
      make('BATT_UNDER_VOLT', 340, 331, 61.2),
    ];
  }
}
