import type { ReactNode } from 'react';
import { MEASUREMENTS } from '../../config/measurements';
import type { MeasurementId, MeasurementSample } from '../../types/vehicle';
import { formatNumber, formatRange } from '../../utils/format';
import { displayFraction, resolveMeasurement } from '../../utils/measurement';
import { formatAge } from '../../utils/time';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';

/**
 * One measurement, shown the way a driver reads it: big number, unit beside it,
 * a word for its state, and an explicit note when the value cannot be trusted.
 */
export function MetricTile({
  id,
  sample,
  now,
  showRange = true,
  footer,
}: {
  id: MeasurementId;
  sample: MeasurementSample | null | undefined;
  now: number;
  showRange?: boolean;
  footer?: ReactNode;
}) {
  const descriptor = MEASUREMENTS[id];
  const resolved = resolveMeasurement(id, sample, now);
  const fraction = displayFraction(id, resolved.value);
  const unavailable = resolved.value === null;

  const bandTone =
    resolved.band === 'normal'
      ? 'normal'
      : resolved.band === 'warning'
        ? 'warning'
        : resolved.band === 'critical'
          ? 'critical'
          : 'unavailable';

  return (
    <article className={`metric metric--${resolved.band}`}>
      <h3 className="metric__label">{descriptor.label}</h3>

      <p className="metric__value-row">
        <span className="metric__value tabular">
          {unavailable ? '—' : formatNumber(resolved.value, descriptor.decimals)}
        </span>
        <span className="metric__unit">{descriptor.unit}</span>
        <span className="sr-only">
          {unavailable
            ? `${descriptor.label} is not available`
            : `${descriptor.label} is ${formatNumber(resolved.value, descriptor.decimals)} ${descriptor.unitSpoken}, ${resolved.band}`}
        </span>
      </p>

      {fraction !== null ? (
        <div className="metric__bar" aria-hidden="true">
          <div
            className={`metric__bar-fill metric__bar-fill--${resolved.band}`}
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      ) : null}

      <div className="metric__meta">
        <StatusPill tone={bandTone}>
          {resolved.band === 'normal'
            ? 'Normal'
            : resolved.band === 'warning'
              ? 'Outside normal'
              : resolved.band === 'critical'
                ? 'Past limit'
                : 'Unavailable'}
        </StatusPill>
        {resolved.stale ? (
          <StatusPill tone="warning" icon="clock">
            Stale
          </StatusPill>
        ) : null}
        {showRange ? (
          <span>
            Normal {formatRange(descriptor.thresholds.normalMin, descriptor.thresholds.normalMax, descriptor.unit)}
          </span>
        ) : null}
        <span>Updated {formatAge(resolved.sample?.receivedAt, now)}</span>
      </div>

      {resolved.problem ? (
        <p className="metric__meta" style={{ color: 'var(--warning-ink)' }}>
          <Icon name="alert-triangle" size={13} />
          {resolved.problem}
        </p>
      ) : null}

      {footer}
    </article>
  );
}
