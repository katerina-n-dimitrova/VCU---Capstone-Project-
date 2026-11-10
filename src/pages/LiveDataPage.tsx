import { useMemo, useState } from 'react';
import { useVehicleData } from '../state/vehicleContext';
import { MEASUREMENTS, MEASUREMENT_IDS, staleTimeoutMs } from '../config/measurements';
import { resolveMeasurement } from '../utils/measurement';
import { formatNumber, formatRange, pluralise } from '../utils/format';
import { formatAge, formatClockSeconds } from '../utils/time';
import { QUALITY_LABEL } from '../utils/status';
import { StatusPill } from '../components/common/StatusPill';
import { Banner } from '../components/common/Banner';
import { LoadingBlock } from '../components/common/StateBlock';
import { ThresholdNote } from '../components/common/ThresholdNote';
import { Icon } from '../components/common/Icon';

type ViewMode = 'simple' | 'technical';

export function LiveDataPage() {
  const { measurements, now, loading, connection, status, simulated } = useVehicleData();
  const [view, setView] = useState<ViewMode>('simple');

  const rows = useMemo(
    () =>
      MEASUREMENT_IDS.map((id) => ({
        descriptor: MEASUREMENTS[id],
        resolved: resolveMeasurement(id, measurements?.[id], now),
      })),
    [measurements, now],
  );

  const staleCount = rows.filter((row) => row.resolved.stale).length;
  const missingCount = rows.filter(
    (row) => row.resolved.quality === 'missing' || row.resolved.quality === 'invalid',
  ).length;

  if (loading) {
    return (
      <div className="page">
        <Heading view={view} setView={setView} />
        <LoadingBlock what="live measurements" />
      </div>
    );
  }

  return (
    <div className="page">
      <Heading view={view} setView={setView} />

      {simulated ? (
        <Banner tone="demo">
          <strong>Simulated data.</strong> These values come from the built-in simulator, not from a
          vehicle.
        </Banner>
      ) : null}

      {staleCount > 0 ? (
        <Banner tone="warning" role="status">
          <strong>
            {staleCount} {pluralise(staleCount, 'measurement')}{' '}
            {staleCount === 1 ? 'has' : 'have'} not updated within{' '}
            {staleCount === 1 ? 'its' : 'their'} expected time.
          </strong>{' '}
          Stale rows are marked below. Do not treat them as current readings.
        </Banner>
      ) : null}

      {missingCount > 0 ? (
        <Banner tone="offline" role="status">
          <strong>
            {missingCount} {pluralise(missingCount, 'measurement')} unavailable.
          </strong>{' '}
          A missing value is shown as “—”. It is never shown as zero.
        </Banner>
      ) : null}

      {connection.state !== 'open' && !simulated ? (
        <Banner tone="critical" role="alert">
          <strong>Not receiving live updates.</strong> {connection.detail}
        </Banner>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <caption>
            {view === 'simple'
              ? 'Live measurements, updated as they arrive over the data stream.'
              : 'Live measurements with raw values, signal identifiers and communication state.'}
            {status ? ` Frame ${status.sequenceNumber}, ${formatClockSeconds(status.timestamp)}.` : ''}
          </caption>
          <thead>
            <tr>
              <th scope="col">Measurement</th>
              <th scope="col">Value</th>
              <th scope="col">Unit</th>
              <th scope="col">Normal range</th>
              <th scope="col">Status</th>
              <th scope="col">Last update</th>
              <th scope="col">Source</th>
              {view === 'technical' ? (
                <>
                  <th scope="col">Raw</th>
                  <th scope="col">Signal</th>
                  <th scope="col">CAN ID</th>
                  <th scope="col">Sampled</th>
                  <th scope="col">Received</th>
                  <th scope="col">Validity</th>
                  <th scope="col">Link</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ descriptor, resolved }) => {
              const unavailable = resolved.value === null;
              const rowClass = resolved.stale
                ? 'row--stale'
                : unavailable
                  ? 'row--unavailable'
                  : undefined;
              return (
                <tr key={descriptor.id} className={rowClass}>
                  <th scope="row" style={{ fontWeight: 600 }}>
                    {view === 'simple' ? descriptor.label : descriptor.technicalLabel}
                    {view === 'simple' ? (
                      <span className="muted" style={{ display: 'block', fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                        {descriptor.help}
                      </span>
                    ) : null}
                  </th>
                  <td className="num" style={{ fontWeight: 650 }}>
                    {unavailable ? '—' : formatNumber(resolved.value, descriptor.decimals)}
                  </td>
                  <td>{descriptor.unit}</td>
                  <td className="num">
                    {formatRange(
                      descriptor.thresholds.normalMin,
                      descriptor.thresholds.normalMax,
                      descriptor.unit,
                    )}
                  </td>
                  <td>
                    <div className="chip-row">
                      <StatusPill
                        tone={
                          resolved.band === 'normal'
                            ? 'normal'
                            : resolved.band === 'warning'
                              ? 'warning'
                              : resolved.band === 'critical'
                                ? 'critical'
                                : 'unavailable'
                        }
                      >
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
                    </div>
                    {resolved.problem ? (
                      <span
                        className="muted"
                        style={{ display: 'block', fontSize: 'var(--text-xs)', marginTop: 4 }}
                      >
                        {resolved.problem}
                      </span>
                    ) : null}
                  </td>
                  <td className="num">
                    {formatAge(resolved.sample?.receivedAt, now)}
                    <span className="muted" style={{ display: 'block', fontSize: 'var(--text-xs)' }}>
                      expected every {descriptor.expectedIntervalMs} ms
                    </span>
                  </td>
                  <td>{descriptor.source}</td>

                  {view === 'technical' ? (
                    <>
                      <td className="num mono">
                        {resolved.sample?.rawValue === null || resolved.sample?.rawValue === undefined
                          ? '—'
                          : resolved.sample.rawValue}
                        <span
                          className="muted"
                          style={{ display: 'block', fontSize: 'var(--text-xs)' }}
                        >
                          ×{descriptor.scaling.factor}
                          {descriptor.scaling.offset !== 0
                            ? ` offset ${descriptor.scaling.offset}`
                            : ''}
                        </span>
                      </td>
                      <td className="mono">{descriptor.signal}</td>
                      <td className="mono">{descriptor.canId}</td>
                      <td className="num mono">
                        {resolved.sample?.sampledAt
                          ? formatClockSeconds(resolved.sample.sampledAt)
                          : '—'}
                      </td>
                      <td className="num mono">
                        {resolved.sample?.receivedAt
                          ? formatClockSeconds(resolved.sample.receivedAt)
                          : '—'}
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            resolved.quality === 'valid'
                              ? 'normal'
                              : resolved.quality === 'stale'
                                ? 'warning'
                                : 'unavailable'
                          }
                        >
                          {QUALITY_LABEL[resolved.quality]}
                        </StatusPill>
                        <span
                          className="muted"
                          style={{ display: 'block', fontSize: 'var(--text-xs)', marginTop: 4 }}
                        >
                          timeout {staleTimeoutMs(descriptor.id)} ms
                        </span>
                      </td>
                      <td>
                        <StatusPill
                          tone={status?.communication.canConnected ? 'normal' : 'offline'}
                        >
                          {status?.communication.canConnected ? 'CAN up' : 'CAN down'}
                        </StatusPill>
                        <span
                          className="muted"
                          style={{ display: 'block', fontSize: 'var(--text-xs)', marginTop: 4 }}
                        >
                          {descriptor.sourceComponent}
                        </span>
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ThresholdNote />

      <p className="muted" style={{ fontSize: 'var(--text-sm)', display: 'flex', gap: 6 }}>
        <Icon name="info" size={15} />
        Values update through the data stream. The page does not need to be refreshed.
      </p>
    </div>
  );
}

function Heading({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  return (
    <header className="page-header">
      <div className="spread">
        <div>
          <h1 className="page-header__title">Live data</h1>
          <p className="page-header__description">
            All measurements as they arrive, with their units, normal ranges and sources.
          </p>
        </div>
        <div
          className="segmented"
          role="group"
          aria-label="Choose how much detail to show"
        >
          <button
            type="button"
            className="segmented__option"
            aria-pressed={view === 'simple'}
            onClick={() => setView('simple')}
          >
            Simple view
          </button>
          <button
            type="button"
            className="segmented__option"
            aria-pressed={view === 'technical'}
            onClick={() => setView('technical')}
          >
            Technical view
          </button>
        </div>
      </div>
    </header>
  );
}
