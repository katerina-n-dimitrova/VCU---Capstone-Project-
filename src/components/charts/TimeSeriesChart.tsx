import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MEASUREMENTS } from '../../config/measurements';
import { useVehicleData } from '../../state/vehicleContext';
import type { MeasurementId } from '../../types/vehicle';
import { formatNumber } from '../../utils/format';
import { formatAxisTime, formatClockSeconds } from '../../utils/time';
import { CHART, SERIES_COLOR_VAR } from './chartTheme';
import { SeverityIcon } from '../common/SeverityIcon';
import { ThresholdNote } from '../common/ThresholdNote';

export interface TimeSeriesChartProps {
  /** Measurements drawn on one axis. They must share a unit. */
  series: MeasurementId[];
  title: string;
  fromMs: number;
  toMs?: number;
  height?: number;
  /** Draw the placeholder warning and critical lines. */
  showThresholds?: boolean;
  /** Mark fault events that were raised against these measurements. */
  showFaultMarkers?: boolean;
  description?: string;
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
}

export function TimeSeriesChart({
  series,
  title,
  fromMs,
  toMs,
  height = 220,
  showThresholds = true,
  showFaultMarkers = true,
  description,
}: TimeSeriesChartProps) {
  const { history, historyVersion, now } = useVehicleData();
  const end = toMs ?? now;

  const rows = useMemo(
    () => history.windowRows(series, fromMs, 480, end),
    // historyVersion is the signal that the store changed underneath us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, historyVersion, series, fromMs, end],
  );

  const markers = useMemo(
    () =>
      showFaultMarkers
        ? series.flatMap((id) => history.markersIn(fromMs, end, id))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, historyVersion, series, fromMs, end, showFaultMarkers],
  );

  const primary = MEASUREMENTS[series[0]];
  const unit = primary.unit;
  const windowMs = end - fromMs;

  const domain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      for (const id of series) {
        const value = row[id];
        if (typeof value === 'number') {
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [primary.thresholds.displayMin, primary.thresholds.displayMax] as const;
    }
    const span = Math.max(max - min, Math.abs(max) * 0.02, 1);
    return [min - span * 0.15, max + span * 0.15] as const;
  }, [rows, series, primary]);

  const thresholdLines = showThresholds
    ? (
        [
          { value: primary.thresholds.warningHigh, tone: 'warning', label: 'Warning' },
          { value: primary.thresholds.warningLow, tone: 'warning', label: 'Warning' },
          { value: primary.thresholds.criticalHigh, tone: 'critical', label: 'Critical' },
          { value: primary.thresholds.criticalLow, tone: 'critical', label: 'Critical' },
        ] as const
      ).filter(
        (line) =>
          line.value !== null && line.value >= domain[0] && line.value <= domain[1],
      )
    : [];

  const hasData = rows.some((row) => series.some((id) => typeof row[id] === 'number'));

  return (
    <div className="chart-card__plot">
      {!hasData ? (
        <p className="muted" style={{ padding: 'var(--space-4)' }}>
          No data recorded in this time window yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={rows} margin={{ ...CHART.margin }}>
            <CartesianGrid stroke={CHART.gridColor} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[fromMs, end]}
              tickFormatter={(value: number) => formatAxisTime(value, windowMs)}
              stroke={CHART.axisColor}
              tick={{ fill: CHART.tickColor, fontSize: CHART.tickFontSize }}
              minTickGap={44}
            />
            <YAxis
              domain={[domain[0], domain[1]]}
              stroke={CHART.axisColor}
              tick={{ fill: CHART.tickColor, fontSize: CHART.tickFontSize }}
              width={46}
              tickFormatter={(value: number) => formatNumber(value, primary.decimals > 0 ? 0 : 0)}
              label={{
                value: unit,
                position: 'insideTopLeft',
                fill: CHART.tickColor,
                fontSize: 11,
                offset: -2,
              }}
            />

            {thresholdLines.map((line) => (
              <ReferenceLine
                key={`${line.label}-${line.value}`}
                y={line.value as number}
                stroke={line.tone === 'critical' ? CHART.criticalColor : CHART.warningColor}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                ifOverflow="hidden"
                label={{
                  value: `${line.label} ${line.value} ${unit}`,
                  position: 'insideTopRight',
                  fill: line.tone === 'critical' ? 'var(--critical-ink)' : 'var(--warning-ink)',
                  fontSize: 10,
                }}
              />
            ))}

            {markers.map((marker) => (
              <ReferenceLine
                key={`${marker.faultId}-${marker.t}`}
                x={marker.t}
                stroke={CHART.markerColor}
                strokeWidth={1.5}
                strokeDasharray="2 3"
                ifOverflow="hidden"
                label={{
                  value: marker.code,
                  position: 'top',
                  fill: 'var(--critical-ink)',
                  fontSize: 10,
                }}
              />
            ))}

            {series.map((id) => {
              const descriptor = MEASUREMENTS[id];
              return (
                <Line
                  key={id}
                  type="linear"
                  dataKey={id}
                  name={descriptor.label}
                  stroke={SERIES_COLOR_VAR[descriptor.seriesSlot]}
                  strokeWidth={CHART.strokeWidth}
                  strokeDasharray={descriptor.dashPattern}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  isAnimationActive={CHART.animation}
                  connectNulls={false}
                />
              );
            })}

            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: CHART.axisColor, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="chart-tooltip">
                    <p className="chart-tooltip__time">
                      {formatClockSeconds(new Date(Number(label)).toISOString())}
                    </p>
                    {(payload as readonly TooltipPayloadEntry[]).map((entry) => {
                      const id = entry.dataKey as MeasurementId;
                      const descriptor = MEASUREMENTS[id];
                      if (!descriptor) return null;
                      return (
                        <p className="chart-tooltip__row" key={String(entry.dataKey)}>
                          <svg width="14" height="8" aria-hidden="true">
                            <line
                              x1="0"
                              y1="4"
                              x2="14"
                              y2="4"
                              stroke={entry.color}
                              strokeWidth="2.5"
                              strokeDasharray={descriptor.dashPattern}
                            />
                          </svg>
                          {descriptor.label}:{' '}
                          <strong>
                            {entry.value === null || entry.value === undefined
                              ? 'no value'
                              : `${formatNumber(Number(entry.value), descriptor.decimals)} ${descriptor.unit}`}
                          </strong>
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {description ? (
        <p className="muted" style={{ padding: '0 var(--space-2)', fontSize: 'var(--text-sm)' }}>
          {description}
        </p>
      ) : null}

      {markers.length > 0 ? (
        <p
          className="muted"
          style={{
            padding: '0 var(--space-2)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <SeverityIcon severity="critical" size={13} />
          {markers.length === 1
            ? `1 fault event is marked on this chart (${markers[0].code}).`
            : `${markers.length} fault events are marked on this chart.`}
        </p>
      ) : null}

      <div style={{ padding: '0 var(--space-2)' }}>
        <span className="sr-only">
          {title}. This chart is summarised in the table of current, minimum, maximum and average
          values below it.
        </span>
        {showThresholds && thresholdLines.length > 0 ? <ThresholdNote compact /> : null}
      </div>
    </div>
  );
}
