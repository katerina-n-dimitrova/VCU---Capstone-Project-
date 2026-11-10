import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVehicleData } from '../state/vehicleContext';
import { ChartCard } from '../components/charts/ChartCard';
import { Banner } from '../components/common/Banner';
import { StateBlock } from '../components/common/StateBlock';
import { ThresholdNote } from '../components/common/ThresholdNote';
import { Icon } from '../components/common/Icon';
import {
  CHARTABLE_MEASUREMENT_IDS,
  COMPARISON_GROUPS,
  MEASUREMENTS,
} from '../config/measurements';
import { TIME_WINDOWS } from '../state/history';
import type { MeasurementId } from '../types/vehicle';
import { formatDateTime } from '../utils/time';

function toLocalInputValue(ms: number): string {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function AnalysisPage() {
  const { history, now, loading, simulated } = useVehicleData();
  const [searchParams] = useSearchParams();
  const [windowId, setWindowId] = useState('5m');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const focus = searchParams.get('focus') as MeasurementId | null;

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`chart-anchor-${focus}`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  }, [focus]);

  const earliest = useMemo(() => {
    const values = CHARTABLE_MEASUREMENT_IDS.map((id) => history.earliest(id)).filter(
      (value): value is number => value !== null,
    );
    return values.length > 0 ? Math.min(...values) : null;
  }, [history]);

  const { fromMs, toMs, windowLabel } = useMemo(() => {
    const option = TIME_WINDOWS.find((w) => w.id === windowId) ?? TIME_WINDOWS[1];
    if (option.id === 'custom') {
      const parsedFrom = customFrom ? Date.parse(customFrom) : NaN;
      const parsedTo = customTo ? Date.parse(customTo) : NaN;
      return {
        fromMs: Number.isFinite(parsedFrom) ? parsedFrom : (earliest ?? now - 15 * 60_000),
        toMs: Number.isFinite(parsedTo) ? parsedTo : now,
        windowLabel: 'Custom range',
      };
    }
    if (option.durationMs === null) {
      return {
        fromMs: earliest ?? now - 30 * 60_000,
        toMs: now,
        windowLabel: 'Current session',
      };
    }
    return { fromMs: now - option.durationMs, toMs: now, windowLabel: option.label };
  }, [windowId, customFrom, customTo, earliest, now]);

  if (loading) {
    return (
      <div className="page">
        <Heading />
        <StateBlock title="Waiting for data to chart…" busy />
      </div>
    );
  }

  return (
    <div className="page">
      <Heading />

      {simulated ? (
        <Banner tone="demo">
          <strong>Simulated data.</strong> These graphs are drawn from the built-in simulator.
        </Banner>
      ) : null}

      <section className="filter-bar" aria-labelledby="time-window-label">
        <div className="field" style={{ flex: '1 1 100%' }}>
          <span className="field__label" id="time-window-label">
            Time window
          </span>
          <div className="segmented" role="group" aria-labelledby="time-window-label">
            {TIME_WINDOWS.map((option) => {
              const disabled = option.id === 'custom' && earliest === null;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="segmented__option"
                  aria-pressed={windowId === option.id}
                  disabled={disabled}
                  title={
                    disabled ? 'A custom range needs stored data, which is not available yet.' : undefined
                  }
                  onClick={() => {
                    setWindowId(option.id);
                    if (option.id === 'custom' && !customFrom && earliest !== null) {
                      setCustomFrom(toLocalInputValue(earliest));
                      setCustomTo(toLocalInputValue(now));
                    }
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {windowId === 'custom' ? (
          <>
            <div className="field">
              <label className="field__label" htmlFor="custom-from">
                From
              </label>
              <input
                id="custom-from"
                className="input"
                type="datetime-local"
                value={customFrom}
                min={earliest !== null ? toLocalInputValue(earliest) : undefined}
                max={toLocalInputValue(now)}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="custom-to">
                To
              </label>
              <input
                id="custom-to"
                className="input"
                type="datetime-local"
                value={customTo}
                min={customFrom || undefined}
                max={toLocalInputValue(now)}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          </>
        ) : null}
      </section>

      <p className="muted" aria-live="polite">
        Showing {windowLabel.toLowerCase()}: {formatDateTime(new Date(fromMs).toISOString())} to{' '}
        {formatDateTime(new Date(toMs).toISOString())}.
        {earliest !== null
          ? ` Recording started ${formatDateTime(new Date(earliest).toISOString())}.`
          : ''}
      </p>

      <Banner tone="info">
        Measurements are held in this browser for as long as the page stays open. The ESP32 does not
        store history, so closing the app clears it.
      </Banner>

      <section aria-labelledby="comparisons-heading" className="stack">
        <h2 id="comparisons-heading" className="card__title">
          Compare related measurements
        </h2>
        <p className="muted">
          Measurements in different units are drawn as separate charts on a shared time axis rather
          than stacked on one plot with two scales, which is easy to misread.
        </p>

        {COMPARISON_GROUPS.map((group) => (
          <section key={group.id} className="stack-sm">
            <h3 className="card__title" style={{ fontSize: 'var(--text-base)' }}>
              {group.label}
            </h3>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {group.description}
            </p>
            <div className={group.members.length > 1 ? 'grid grid--wide' : 'stack'}>
              {group.members.map((members) => (
                <ChartCard
                  key={members.join('-')}
                  title={
                    members.length === 1
                      ? MEASUREMENTS[members[0]].label
                      : members.map((id) => MEASUREMENTS[id].label).join(', ')
                  }
                  series={members}
                  fromMs={fromMs}
                  toMs={toMs}
                  height={members.length > 1 ? 240 : 200}
                />
              ))}
            </div>
          </section>
        ))}
      </section>

      <section aria-labelledby="individual-heading" className="stack">
        <h2 id="individual-heading" className="card__title">
          Every measurement
        </h2>
        <div className="grid grid--wide">
          {CHARTABLE_MEASUREMENT_IDS.map((id) => (
            <div key={id} id={`chart-anchor-${id}`}>
              <ChartCard
                title={MEASUREMENTS[id].label}
                series={[id]}
                fromMs={fromMs}
                toMs={toMs}
                height={190}
                description={focus === id ? MEASUREMENTS[id].help : undefined}
              />
            </div>
          ))}
        </div>
      </section>

      <ThresholdNote />

      <p className="muted" style={{ fontSize: 'var(--text-sm)', display: 'flex', gap: 6 }}>
        <Icon name="info" size={15} />
        Fault events are marked on the chart of the measurement that triggered them, so what led up
        to a fault is visible alongside it.
      </p>
    </div>
  );
}

function Heading() {
  return (
    <header className="page-header">
      <h1 className="page-header__title">Data analysis</h1>
      <p className="page-header__description">
        Measurements over time, so a problem can be traced back to what led up to it.
      </p>
    </header>
  );
}
