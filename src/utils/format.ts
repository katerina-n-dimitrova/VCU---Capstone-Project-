/**
 * Value formatting.
 *
 * The one rule that matters: a missing value is never printed as 0.
 * `formatValue(null)` gives an em dash and the caller pairs it with a reason.
 */

import { MEASUREMENTS } from '../config/measurements';
import type { MeasurementId } from '../types/vehicle';

export const NO_VALUE = '—';

export function formatNumber(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return value.toFixed(decimals);
}

export function formatMeasurement(
  id: MeasurementId,
  value: number | null | undefined,
): string {
  return formatNumber(value, MEASUREMENTS[id].decimals);
}

/** "72.4 V" or "— V" — the unit always stays beside the number. */
export function formatWithUnit(
  value: number | null | undefined,
  unit: string | null,
  decimals = 1,
): string {
  const text = formatNumber(value, decimals);
  if (!unit) return text;
  return `${text} ${unit}`;
}

/** Screen-reader friendly: "72.4 volts" rather than "72.4 V". */
export function spokenMeasurement(
  id: MeasurementId,
  value: number | null | undefined,
): string {
  const descriptor = MEASUREMENTS[id];
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `${descriptor.label}: no value available`;
  }
  return `${descriptor.label}: ${value.toFixed(descriptor.decimals)} ${descriptor.unitSpoken}`;
}

export function formatRange(
  min: number | null,
  max: number | null,
  unit: string | null,
): string {
  const u = unit ? ` ${unit}` : '';
  if (min !== null && max !== null) return `${min} to ${max}${u}`;
  if (min !== null) return `${min}${u} or above`;
  if (max !== null) return `up to ${max}${u}`;
  return 'Not defined';
}

export function formatCoordinate(value: number | null, decimals = 6): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;
  return value.toFixed(decimals);
}

/** "1.2921° S, 36.8219° E" — easier to read aloud than a signed pair. */
export function formatLatLonHuman(
  latitude: number | null,
  longitude: number | null,
): string {
  if (latitude === null || longitude === null) return 'Not available';
  const lat = `${Math.abs(latitude).toFixed(5)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(5)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
