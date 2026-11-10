/**
 * Chart appearance in one place.
 *
 * The three series colours were run through a colour-vision validator against
 * both the light and the dark chart surface (deuteranopia, protanopia and
 * tritanopia separation, plus contrast). Each series also carries its own dash
 * pattern and is named in the legend, so a line is identifiable without relying
 * on its colour at all.
 *
 * Real-time charts are drawn with animation switched off: a line that slides
 * into place on every frame is harder to read, not easier.
 */

import type { SeriesSlot } from '../../config/measurements';

export const SERIES_COLOR_VAR: Record<SeriesSlot, string> = {
  1: 'var(--series-1)',
  2: 'var(--series-2)',
  3: 'var(--series-3)',
};

export const CHART = {
  strokeWidth: 2,
  gridColor: 'var(--grid)',
  axisColor: 'var(--axis)',
  tickColor: 'var(--ink-muted)',
  tickFontSize: 11,
  /** Threshold reference lines. */
  warningColor: 'var(--warning)',
  criticalColor: 'var(--critical)',
  /** Fault event markers. */
  markerColor: 'var(--critical)',
  animation: false,
  margin: { top: 8, right: 14, bottom: 4, left: 4 },
} as const;
