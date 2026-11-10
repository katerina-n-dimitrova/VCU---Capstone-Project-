import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { VehicleFault } from '../../types/vehicle';
import { MEASUREMENTS } from '../../config/measurements';
import {
  CLEARING_LABEL,
  FAULT_STATUS_LABEL,
  SEVERITY_LABEL,
  SUBSYSTEM_LABEL,
} from '../../utils/status';
import { formatRange, formatWithUnit } from '../../utils/format';
import { formatDateTime, formatAge } from '../../utils/time';
import { SeverityIcon } from '../common/SeverityIcon';
import { StatusPill } from '../common/StatusPill';
import { Icon } from '../common/Icon';
import { ThresholdNote } from '../common/ThresholdNote';
import { LazyChartCard } from '../charts/LazyChartCard';

/**
 * One fault, with plain language first and the technical record behind a
 * disclosure.
 *
 * Nothing in here clears a fault. Clearing is a vehicle-side operation that
 * needs an authorised diagnostic tool, and the card says so rather than
 * offering a button that would not work.
 */
export function FaultCard({
  fault,
  now,
  expanded,
  onToggle,
  onAcknowledge,
}: {
  fault: VehicleFault;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge?: (faultId: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const resolved = fault.status === 'resolved';
  const descriptor = fault.measurementId ? MEASUREMENTS[fault.measurementId] : null;
  const detailsId = `fault-details-${fault.id}`;

  return (
    <article
      className={`fault-card fault-card--${resolved ? 'resolved' : fault.severity}`}
      aria-labelledby={`fault-title-${fault.id}`}
    >
      <div className="fault-card__head">
        <div className="fault-card__title-row">
          <SeverityIcon severity={fault.severity} size={22} />
          <h3 className="fault-card__title" id={`fault-title-${fault.id}`}>
            {fault.title}
          </h3>
          <span className="fault-card__code">{fault.code}</span>
        </div>

        <div className="row">
          <StatusPill
            tone={
              resolved
                ? 'offline'
                : fault.severity === 'information'
                  ? 'information'
                  : fault.severity
            }
          >
            {SEVERITY_LABEL[fault.severity]}
          </StatusPill>
          <StatusPill tone={resolved ? 'normal' : fault.status === 'acknowledged' ? 'information' : 'warning'}>
            {FAULT_STATUS_LABEL[fault.status]}
          </StatusPill>
          <StatusPill tone="unavailable" icon="server">
            {SUBSYSTEM_LABEL[fault.subsystem]}
          </StatusPill>
          {fault.requiresImmediateShutdown && !resolved ? (
            <StatusPill tone="critical" icon="alert-octagon">
              Requires immediate shutdown
            </StatusPill>
          ) : null}
          {!fault.requiresImmediateShutdown && !resolved ? (
            <StatusPill tone={fault.vehicleCanContinue ? 'normal' : 'warning'}>
              {fault.vehicleCanContinue ? 'Vehicle can continue' : 'Vehicle should not be driven'}
            </StatusPill>
          ) : null}
        </div>

        <p>{fault.description}</p>

        <div className="fault-card__meta">
          <span>Detected {formatDateTime(fault.detectedAt)}</span>
          <span>Last seen {formatAge(fault.lastSeenAt, now)}</span>
          {resolved ? <span>Resolved {formatDateTime(fault.resolvedAt)}</span> : null}
          {fault.occurrenceCount > 1 ? <span>Seen {fault.occurrenceCount} times</span> : null}
        </div>
      </div>

      <div className="fault-card__actions">
        <button
          type="button"
          className="btn btn--sm"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={15} />
          {expanded ? 'Hide technical details' : 'Show technical details'}
        </button>

        {onAcknowledge && fault.status === 'active' && !resolved ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onAcknowledge(fault.id)}
          >
            <Icon name="check-circle" size={15} />
            Acknowledge on this device
          </button>
        ) : null}

        {fault.measurementId ? (
          <Link className="btn btn--sm" to={`/analysis?focus=${fault.measurementId}`}>
            <Icon name="chart" size={15} />
            Open in Analysis
          </Link>
        ) : null}
      </div>

      {expanded ? (
        <div className="fault-card__details" id={detailsId}>
          {descriptor ? (
            <section className="fault-section">
              <h4 className="fault-section__heading">Measurement that triggered this fault</h4>
              <dl className="detail-list">
                <Item term="Measurement" value={descriptor.label} />
                <Item term="Signal" value={`${descriptor.signal} (${descriptor.canId})`} mono />
                <Item
                  term="Measured value"
                  value={
                    fault.measuredValue === null
                      ? 'Not recorded'
                      : formatWithUnit(fault.measuredValue, fault.unit, descriptor.decimals)
                  }
                />
                <Item
                  term="Normal range"
                  value={
                    fault.normalRangeText ??
                    formatRange(fault.normalRangeMin, fault.normalRangeMax, fault.unit)
                  }
                />
                <Item
                  term="Warning threshold"
                  value={
                    fault.warningThreshold === null
                      ? 'Not defined'
                      : formatWithUnit(fault.warningThreshold, fault.unit, 0)
                  }
                />
                <Item
                  term="Critical threshold"
                  value={
                    fault.criticalThreshold === null
                      ? 'Not defined'
                      : formatWithUnit(fault.criticalThreshold, fault.unit, 0)
                  }
                />
              </dl>
              <ThresholdNote compact />
            </section>
          ) : null}

          <section className="fault-section">
            <h4 className="fault-section__heading">Possible causes</h4>
            <ul>
              {fault.possibleCauses.map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          </section>

          <section className="fault-section">
            <h4 className="fault-section__heading">Recommended inspection steps</h4>
            <ol>
              {fault.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </section>

          <section className="fault-section">
            <h4 className="fault-section__heading">Operating restrictions</h4>
            <div className="flag-list">
              <StatusPill tone={fault.vehicleCanContinue ? 'normal' : 'critical'}>
                {fault.vehicleCanContinue
                  ? 'The vehicle controller reports the vehicle can continue operating'
                  : 'The vehicle controller reports the vehicle should not continue operating'}
              </StatusPill>
              <StatusPill tone={fault.requiresImmediateShutdown ? 'critical' : 'normal'}>
                {fault.requiresImmediateShutdown
                  ? 'Requires immediate shutdown'
                  : 'Does not require immediate shutdown'}
              </StatusPill>
            </div>
            <p className="muted" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              Both of these are reported by the STM32. This app displays them; it does not work
              them out for itself.
            </p>
          </section>

          <section className="fault-section">
            <h4 className="fault-section__heading">Clearing this fault</h4>
            <p>{CLEARING_LABEL[fault.clearing]}</p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              This application cannot clear faults. Acknowledging a fault here only hides its
              notification on this device — it does not change anything on the vehicle, and the
              fault stays in the history.
            </p>
            <button type="button" className="btn btn--sm" disabled>
              <Icon name="shield" size={15} />
              Clear fault — requires authorised diagnostic support
            </button>
          </section>

          {fault.measurementId ? (
            <section className="fault-section">
              <h4 className="fault-section__heading">Measurement history</h4>
              {showHistory ? (
                <LazyChartCard
                  title={`${MEASUREMENTS[fault.measurementId].label} around this fault`}
                  series={[fault.measurementId]}
                  fromMs={now - 5 * 60_000}
                  height={180}
                />
              ) : (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setShowHistory(true)}
                >
                  <Icon name="chart" size={15} />
                  Show the last 5 minutes
                </button>
              )}
            </section>
          ) : null}

          <section className="fault-section">
            <h4 className="fault-section__heading">Record</h4>
            <dl className="detail-list">
              <Item term="Fault identifier" value={fault.id} mono />
              <Item term="Fault code" value={fault.code} mono />
              <Item term="Subsystem" value={SUBSYSTEM_LABEL[fault.subsystem]} />
              <Item term="First detected" value={formatDateTime(fault.detectedAt)} />
              <Item term="Last occurrence" value={formatDateTime(fault.lastSeenAt)} />
              <Item
                term="Resolved"
                value={fault.resolvedAt ? formatDateTime(fault.resolvedAt) : 'Not resolved'}
              />
              <Item
                term="Acknowledged"
                value={
                  fault.acknowledgedAt
                    ? `${formatDateTime(fault.acknowledgedAt)} (on this device)`
                    : 'Not acknowledged'
                }
              />
              <Item term="Occurrences" value={String(fault.occurrenceCount)} />
            </dl>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function Item({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-list__item">
      <dt className="detail-list__term">{term}</dt>
      <dd className={`detail-list__value${mono ? ' mono' : ''}`}>{value}</dd>
    </div>
  );
}
