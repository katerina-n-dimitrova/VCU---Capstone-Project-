/**
 * In-memory measurement history.
 *
 * The ESP32 is not expected to store history, so the app keeps its own ring
 * buffer for as long as the page is open. Points are held in a mutable store
 * and decimated when they are read, so a 30-minute window does not hand
 * thousands of points to the chart library.
 *
 * A gap in the data is kept as `null`, which makes the line break. It is never
 * filled in with zero or with the previous value.
 */

import { MEASUREMENT_IDS } from '../config/measurements';
import type {
  FaultMarker,
  HistoryPoint,
  MeasurementId,
  MeasurementSnapshot,
  Severity,
} from '../types/vehicle';

/** 30 minutes at 4 Hz. */
export const MAX_POINTS = 7200;
export const SESSION_WINDOW_MS = 30 * 60_000;

/** One row of chart data: a timestamp plus one value per series. */
export type ChartRow = { t: number } & Partial<Record<MeasurementId, number | null>>;

export interface SeriesStats {
  current: number | null;
  min: number | null;
  max: number | null;
  average: number | null;
  count: number;
  /** Number of samples in the window with no value. */
  gaps: number;
}

export class HistoryStore {
  private series: Record<MeasurementId, HistoryPoint[]>;
  private markers: FaultMarker[] = [];
  /** Bumped on every write so consumers can tell something changed. */
  version = 0;

  constructor() {
    this.series = MEASUREMENT_IDS.reduce(
      (acc, id) => {
        acc[id] = [];
        return acc;
      },
      {} as Record<MeasurementId, HistoryPoint[]>,
    );
  }

  seed(id: MeasurementId, points: HistoryPoint[]): void {
    if (points.length === 0) return;
    this.series[id] = points.slice(-MAX_POINTS);
    this.version += 1;
  }

  record(snapshot: MeasurementSnapshot, timestampMs: number): void {
    for (const id of MEASUREMENT_IDS) {
      const sample = snapshot[id];
      const list = this.series[id];
      // A missing or invalid reading is recorded as a gap, not as a number.
      const value =
        sample && sample.quality !== 'missing' && sample.quality !== 'invalid'
          ? sample.value
          : null;
      list.push({ t: timestampMs, v: value });
      if (list.length > MAX_POINTS) list.splice(0, list.length - MAX_POINTS);
    }
    this.version += 1;
  }

  addMarker(marker: FaultMarker): void {
    this.markers.push(marker);
    if (this.markers.length > 200) this.markers.splice(0, this.markers.length - 200);
    this.version += 1;
  }

  markersIn(fromMs: number, toMs: number, measurementId?: MeasurementId | null): FaultMarker[] {
    return this.markers.filter(
      (m) =>
        m.t >= fromMs &&
        m.t <= toMs &&
        (measurementId === undefined || measurementId === null || m.measurementId === measurementId),
    );
  }

  /** Points inside a window, decimated to at most `maxPoints`. */
  window(id: MeasurementId, fromMs: number, maxPoints = 480): HistoryPoint[] {
    const list = this.series[id] ?? [];
    let startIndex = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].t < fromMs) {
        startIndex = i + 1;
        break;
      }
    }
    const slice = list.slice(startIndex);
    if (slice.length <= maxPoints) return slice;

    const step = slice.length / maxPoints;
    const out: HistoryPoint[] = [];
    for (let i = 0; i < maxPoints; i += 1) {
      const from = Math.floor(i * step);
      const to = Math.min(slice.length, Math.floor((i + 1) * step));
      // Keep the extreme of each bucket so spikes survive decimation, and keep
      // a gap if the bucket contains one.
      let pick: HistoryPoint | null = null;
      let sawGap = false;
      for (let j = from; j < to; j += 1) {
        const point = slice[j];
        if (point.v === null) {
          sawGap = true;
          continue;
        }
        if (pick === null || Math.abs(point.v) > Math.abs(pick.v ?? 0)) pick = point;
      }
      if (pick) out.push(pick);
      else if (sawGap) out.push({ t: slice[from].t, v: null });
    }
    // Always keep the newest point so the chart ends at "now".
    const last = slice[slice.length - 1];
    if (out.length === 0 || out[out.length - 1].t !== last.t) out.push(last);
    return out;
  }

  /**
   * Several series merged onto one timeline, which is what a chart needs.
   * Every series is written on the same tick, so they share timestamps and can
   * be decimated together without drifting apart.
   */
  windowRows(
    ids: MeasurementId[],
    fromMs: number,
    maxPoints = 480,
    toMs = Number.POSITIVE_INFINITY,
  ): ChartRow[] {
    if (ids.length === 0) return [];
    const master = this.series[ids[0]] ?? [];
    const indices: number[] = [];
    for (let i = 0; i < master.length; i += 1) {
      if (master[i].t >= fromMs && master[i].t <= toMs) indices.push(i);
    }
    if (indices.length === 0) return [];

    const rowAt = (index: number): ChartRow => {
      const row: ChartRow = { t: master[index].t };
      for (const id of ids) {
        const point = this.series[id]?.[index];
        row[id] = point ? point.v : null;
      }
      return row;
    };

    if (indices.length <= maxPoints) return indices.map(rowAt);

    const step = indices.length / maxPoints;
    const out: ChartRow[] = [];
    for (let bucket = 0; bucket < maxPoints; bucket += 1) {
      const from = Math.floor(bucket * step);
      const to = Math.min(indices.length, Math.floor((bucket + 1) * step));
      let bestIndex = indices[from];
      let bestMagnitude = -1;
      for (let j = from; j < to; j += 1) {
        const index = indices[j];
        let magnitude = -1;
        for (const id of ids) {
          const point = this.series[id]?.[index];
          if (point && point.v !== null) magnitude = Math.max(magnitude, Math.abs(point.v));
        }
        if (magnitude > bestMagnitude) {
          bestMagnitude = magnitude;
          bestIndex = index;
        }
      }
      out.push(rowAt(bestIndex));
    }
    const lastIndex = indices[indices.length - 1];
    if (out[out.length - 1].t !== master[lastIndex].t) out.push(rowAt(lastIndex));
    return out;
  }

  stats(id: MeasurementId, fromMs: number): SeriesStats {
    const list = this.series[id] ?? [];
    let min: number | null = null;
    let max: number | null = null;
    let sum = 0;
    let count = 0;
    let gaps = 0;
    let current: number | null = null;

    for (let i = list.length - 1; i >= 0; i -= 1) {
      const point = list[i];
      if (point.t < fromMs) break;
      if (point.v === null) {
        gaps += 1;
        continue;
      }
      if (current === null) current = point.v;
      if (min === null || point.v < min) min = point.v;
      if (max === null || point.v > max) max = point.v;
      sum += point.v;
      count += 1;
    }

    return {
      current,
      min,
      max,
      average: count > 0 ? sum / count : null,
      count,
      gaps,
    };
  }

  /** Oldest timestamp held for a series, so the UI can say how far back it goes. */
  earliest(id: MeasurementId): number | null {
    const list = this.series[id] ?? [];
    return list.length > 0 ? list[0].t : null;
  }
}

export interface TimeWindowOption {
  id: string;
  label: string;
  /** null means "everything recorded in this session". */
  durationMs: number | null;
}

export const TIME_WINDOWS: TimeWindowOption[] = [
  { id: '1m', label: 'Last minute', durationMs: 60_000 },
  { id: '5m', label: 'Last 5 minutes', durationMs: 5 * 60_000 },
  { id: '15m', label: 'Last 15 minutes', durationMs: 15 * 60_000 },
  { id: 'session', label: 'Current session', durationMs: null },
  { id: 'custom', label: 'Custom range', durationMs: null },
];

export function severityRank(severity: Severity): number {
  return { information: 0, warning: 1, critical: 2, emergency: 3 }[severity];
}
