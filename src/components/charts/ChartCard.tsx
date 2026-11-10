import { useMemo } from 'react';
import { MEASUREMENTS } from '../../config/measurements';
import { useVehicleData } from '../../state/vehicleContext';
import type { MeasurementId } from '../../types/vehicle';
import { formatNumber, formatRange } from '../../utils/format';
import { TimeSeriesChart } from './TimeSeriesChart';
import { SERIES_COLOR_VAR } from './chartTheme';

/**
 * A chart with everything a technician needs beside it: units, a legend naming
 * every line, and the current, minimum, maximum and average for the window.
 *
 * The numeric summary is not decoration — it is the text alternative to the
 * plot, so the chart never has to be read by colour alone.
 */
export function ChartCard({
  title,
  series,
  fromMs,
  toMs,
  description,
  height,
  showThresholds = true,
}: {
  title: string;
  series: MeasurementId[];
  fromMs: number;
  toMs?: number;
  description?: string;
  height?: number;
  showThresholds?: boolean;
}) {
  const { history, historyVersion } = useVehicleData();
  const primary = MEASUREMENTS[series[0]];

  const stats = useMemo(
    () => series.map((id) => ({ id, ...history.stats(id, fromMs) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, historyVersion, series, fromMs],
  );

  return (
    <section className="chart-card" aria-labelledby={`chart-${series.join('-')}`}>
      <header className="chart-card__head">
        <h3 className="chart-card__title" id={`chart-${series.join('-')}`}>
          {title}
        </h3>
        <p className="chart-card__unit">
          Measured in {primary.unitSpoken} ({primary.unit}) · normal{' '}
          {formatRange(primary.thresholds.normalMin, primary.thresholds.normalMax, primary.unit)}
        </p>
      </header>

      {series.length > 1 ? (
        <ul className="chart-legend" style={{ listStyle: 'none', margin: 0 }}>
          {series.map((id) => {
            const descriptor = MEASUREMENTS[id];
            return (
              <li className="chart-legend__item" key={id}>
                <svg width="20" height="10" aria-hidden="true">
                  <line
                    x1="0"
                    y1="5"
                    x2="20"
                    y2="5"
                    stroke={SERIES_COLOR_VAR[descriptor.seriesSlot]}
                    strokeWidth="2.5"
                    strokeDasharray={descriptor.dashPattern}
                  />
                </svg>
                {descriptor.label}
              </li>
            );
          })}
        </ul>
      ) : null}

      <TimeSeriesChart
        series={series}
        title={title}
        fromMs={fromMs}
        toMs={toMs}
        height={height}
        description={description}
        showThresholds={showThresholds}
      />

      {stats.map((stat) => (
        <div className="chart-stats" key={stat.id}>
          {series.length > 1 ? (
            <div className="chart-stat">
              <span className="chart-stat__label">Series</span>
              <span className="chart-stat__value" style={{ fontSize: 'var(--text-sm)' }}>
                {MEASUREMENTS[stat.id].label}
              </span>
            </div>
          ) : null}
          <Stat label="Current" value={stat.current} id={stat.id} />
          <Stat label="Minimum" value={stat.min} id={stat.id} />
          <Stat label="Maximum" value={stat.max} id={stat.id} />
          <Stat label="Average" value={stat.average} id={stat.id} />
          {stat.gaps > 0 ? (
            <div className="chart-stat">
              <span className="chart-stat__label">Gaps</span>
              <span className="chart-stat__value">{stat.gaps}</span>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function Stat({
  label,
  value,
  id,
}: {
  label: string;
  value: number | null;
  id: MeasurementId;
}) {
  const descriptor = MEASUREMENTS[id];
  return (
    <div className="chart-stat">
      <span className="chart-stat__label">{label}</span>
      <span className="chart-stat__value">
        {value === null ? '—' : formatNumber(value, descriptor.decimals)}{' '}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {descriptor.unit}
        </span>
      </span>
    </div>
  );
}
