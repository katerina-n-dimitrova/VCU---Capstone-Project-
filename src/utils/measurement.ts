/**
 * Working out what a single reading actually is, right now.
 *
 * Missing, stale and invalid are three different things and are kept apart:
 *  - missing  — the device told us there is no value
 *  - invalid  — a value arrived but the device flagged it as not trustworthy
 *  - stale    — a value arrived, but longer ago than this signal's timeout
 *  - valid    — a fresh, trustworthy value
 *
 * A value is never substituted with zero in any of these cases.
 */

import { MEASUREMENTS, staleTimeoutMs } from '../config/measurements';
import type {
  MeasurementId,
  MeasurementQuality,
  MeasurementSample,
} from '../types/vehicle';
import { displayBand, type DisplayBand } from './status';
import { ageMs } from './time';

export interface ResolvedMeasurement {
  id: MeasurementId;
  sample: MeasurementSample | null;
  value: number | null;
  quality: MeasurementQuality;
  /** How old the value is, in ms. null when we have never had one. */
  ageMs: number | null;
  stale: boolean;
  band: DisplayBand;
  /** One sentence explaining why a value is not usable, or null when it is. */
  problem: string | null;
}

export function resolveMeasurement(
  id: MeasurementId,
  sample: MeasurementSample | null | undefined,
  now: number,
): ResolvedMeasurement {
  const descriptor = MEASUREMENTS[id];

  if (!sample) {
    return {
      id,
      sample: null,
      value: null,
      quality: 'missing',
      ageMs: null,
      stale: false,
      band: 'unavailable',
      problem: 'No reading has been received for this measurement.',
    };
  }

  const age = ageMs(sample.receivedAt ?? sample.sampledAt, now);
  const timeout = staleTimeoutMs(id);

  if (sample.quality === 'missing' || sample.value === null) {
    return {
      id,
      sample,
      value: null,
      quality: 'missing',
      ageMs: age,
      stale: false,
      band: 'unavailable',
      problem:
        sample.qualityDetail ??
        `${descriptor.label} is not being reported by the vehicle controller.`,
    };
  }

  if (sample.quality === 'invalid') {
    return {
      id,
      sample,
      value: sample.value,
      quality: 'invalid',
      ageMs: age,
      stale: false,
      band: 'unavailable',
      problem:
        sample.qualityDetail ??
        'The vehicle controller marked this reading as not trustworthy.',
    };
  }

  const stale = sample.quality === 'stale' || (age !== null && age > timeout);

  return {
    id,
    sample,
    value: sample.value,
    quality: stale ? 'stale' : 'valid',
    ageMs: age,
    stale,
    band: displayBand(id, sample.value, stale ? 'stale' : 'valid'),
    problem: stale
      ? `This reading has not been updated for more than ${Math.round(timeout / 100) / 10} s. It may no longer reflect the vehicle.`
      : null,
  };
}

/** Fraction of the display range a value sits at, for the small bar in a tile. */
export function displayFraction(id: MeasurementId, value: number | null): number | null {
  if (value === null) return null;
  const { displayMin, displayMax } = MEASUREMENTS[id].thresholds;
  if (displayMax === displayMin) return null;
  return Math.min(1, Math.max(0, (value - displayMin) / (displayMax - displayMin)));
}
