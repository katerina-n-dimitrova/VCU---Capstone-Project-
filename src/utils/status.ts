/**
 * Status helpers.
 *
 * SAFETY BOUNDARY (see README):
 * Nothing here decides whether the vehicle is safe. Two different things happen
 * in this file and it is worth keeping them apart:
 *
 *  1. `displayBand` colours a number against the PLACEHOLDER thresholds so a
 *     reading is easy to scan. It is a display hint only. It never creates a
 *     fault, never changes a fault, and never appears as a fault anywhere.
 *  2. `deriveOverallStatus` rolls up the faults the STM32 has ALREADY reported,
 *     plus the state of the link, into one headline word. It reports; it does
 *     not judge.
 */

import type {
  MeasurementId,
  MeasurementQuality,
  OverallStatus,
  Severity,
  VehicleFault,
  VehicleStatus,
} from '../types/vehicle';
import { MEASUREMENTS } from '../config/measurements';

/** A display band for a single reading. Not a fault. */
export type DisplayBand = 'normal' | 'warning' | 'critical' | 'unavailable';

export function displayBand(
  id: MeasurementId,
  value: number | null,
  quality: MeasurementQuality = 'valid',
): DisplayBand {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  if (quality === 'missing' || quality === 'invalid') return 'unavailable';
  const t = MEASUREMENTS[id].thresholds;
  if (t.criticalHigh !== null && value >= t.criticalHigh) return 'critical';
  if (t.criticalLow !== null && value <= t.criticalLow) return 'critical';
  if (t.warningHigh !== null && value >= t.warningHigh) return 'warning';
  if (t.warningLow !== null && value <= t.warningLow) return 'warning';
  return 'normal';
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  information: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  information: 'Information',
  warning: 'Warning',
  critical: 'Critical',
  emergency: 'Emergency',
};

/**
 * Text symbol paired with every severity, so severity is never colour-alone.
 * These are drawn as real SVG icons in `SeverityIcon`; the text label always
 * appears next to them.
 */
export const SEVERITY_SYMBOL: Record<Severity, string> = {
  information: 'i',
  warning: '!',
  critical: '!!',
  emergency: '✖',
};

export function highestSeverity(faults: VehicleFault[]): Severity | null {
  let highest: Severity | null = null;
  for (const fault of faults) {
    if (highest === null || SEVERITY_ORDER[fault.severity] > SEVERITY_ORDER[highest]) {
      highest = fault.severity;
    }
  }
  return highest;
}

export function compareSeverityDesc(a: VehicleFault, b: VehicleFault): number {
  const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  if (bySeverity !== 0) return bySeverity;
  return Date.parse(b.detectedAt) - Date.parse(a.detectedAt);
}

export interface OverallStatusResult {
  status: OverallStatus;
  /** Plain-language headline shown on the overview. */
  headline: string;
  /** One-sentence explanation of why the headline says what it says. */
  detail: string;
}

/**
 * Roll up what the vehicle has reported into one headline.
 *
 * Inputs are only: the link state, and the severity of faults the STM32 has
 * already raised. No measurement is evaluated here.
 */
export function deriveOverallStatus(
  status: VehicleStatus | null,
  linkOpen: boolean,
): OverallStatusResult {
  if (!status || !linkOpen || !status.communication.esp32Connected) {
    return {
      status: 'offline',
      headline: 'Not connected',
      detail:
        'The app is not receiving data from the vehicle. Nothing on screen should be treated as current.',
    };
  }

  if (!status.communication.stm32Connected || !status.communication.canConnected) {
    return {
      status: 'critical',
      headline: 'No data from the vehicle controller',
      detail:
        'The app is connected to the ESP32, but the ESP32 is not receiving data from the STM32. Readings are from before the link was lost.',
    };
  }

  const unresolved = status.activeFaults.filter((f) => f.status !== 'resolved');
  const worst = highestSeverity(unresolved);

  if (worst === 'emergency' || worst === 'critical') {
    const shutdown = unresolved.some((f) => f.requiresImmediateShutdown);
    return {
      status: 'critical',
      headline: worst === 'emergency' ? 'Emergency fault reported' : 'Critical fault reported',
      detail: shutdown
        ? 'The vehicle controller reports a fault that requires the vehicle to be stopped.'
        : 'The vehicle controller has reported a fault that needs attention before driving on.',
    };
  }

  if (worst === 'warning') {
    return {
      status: 'warning',
      headline: 'Warning reported',
      detail: 'The vehicle can keep operating, but something needs checking.',
    };
  }

  if (worst === 'information') {
    const count = unresolved.filter((f) => f.severity === 'information').length;
    return {
      status: 'normal',
      headline: 'Operating normally',
      detail:
        count === 1
          ? 'No faults affecting operation. One informational message is listed.'
          : `No faults affecting operation. ${count} informational messages are listed.`,
    };
  }

  return {
    status: 'normal',
    headline: 'Operating normally',
    detail: 'The vehicle controller reports no active faults.',
  };
}

export const OPERATING_STATE_LABEL: Record<VehicleStatus['operatingState'], string> = {
  off: 'Off',
  starting: 'Starting up',
  ready: 'Ready',
  driving: 'Driving',
  limited: 'Reduced power',
  fault: 'Fault — not driveable',
};

export const OPERATING_STATE_HELP: Record<VehicleStatus['operatingState'], string> = {
  off: 'The drive system is switched off.',
  starting: 'The controller is running its start-up checks, including pre-charge.',
  ready: 'The drive system is on and waiting for throttle input.',
  driving: 'The drive system is delivering power to the motor.',
  limited: 'The controller has reduced available power to protect the vehicle.',
  fault: 'The controller has stopped the drive system because of a fault.',
};

export const SUBSYSTEM_LABEL: Record<VehicleFault['subsystem'], string> = {
  battery: 'Battery',
  motor: 'Motor',
  inverter: 'Inverter',
  mcu: 'Controller board',
  precharge: 'Pre-charge',
  communication: 'Communication',
  location: 'Location',
  sensor: 'Sensors',
};

export const FAULT_STATUS_LABEL: Record<VehicleFault['status'], string> = {
  active: 'Active',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export const CLEARING_LABEL: Record<VehicleFault['clearing'], string> = {
  'self-clearing': 'Clears by itself once the condition goes away',
  'authorized-tool-required': 'Requires an authorised diagnostic tool to clear',
  'service-required': 'Latched — requires a service procedure and a power cycle',
};

export const QUALITY_LABEL: Record<MeasurementQuality, string> = {
  valid: 'Live',
  stale: 'Stale',
  invalid: 'Invalid',
  missing: 'Unavailable',
};
