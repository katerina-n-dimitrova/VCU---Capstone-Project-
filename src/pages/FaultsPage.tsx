import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVehicleData } from '../state/vehicleContext';
import { FaultCard } from '../components/faults/FaultCard';
import { StateBlock } from '../components/common/StateBlock';
import { Banner } from '../components/common/Banner';
import { Icon } from '../components/common/Icon';
import { StatusPill } from '../components/common/StatusPill';
import {
  SEVERITY_LABEL,
  SUBSYSTEM_LABEL,
  compareSeverityDesc,
} from '../utils/status';
import { pluralise } from '../utils/format';
import type { Severity, Subsystem, VehicleFault } from '../types/vehicle';

type StatusFilter = 'all' | 'active' | 'acknowledged' | 'resolved';

const SEVERITIES: Severity[] = ['emergency', 'critical', 'warning', 'information'];
const SUBSYSTEMS: Subsystem[] = [
  'battery',
  'motor',
  'inverter',
  'mcu',
  'precharge',
  'communication',
  'location',
  'sensor',
];

export function FaultsPage() {
  const { activeFaults, faultHistory, now, acknowledgeFault, loading } = useVehicleData();
  const [searchParams, setSearchParams] = useSearchParams();

  // A link from a notification carries the fault to open, so that fault starts
  // expanded and the filters start wide enough to include it.
  const focusId = searchParams.get('fault');

  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [subsystem, setSubsystem] = useState<Subsystem | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(focusId ? 'all' : 'active');
  const [query, setQuery] = useState('');
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  /** A fault is open when it was toggled open, or when it is the linked one. */
  const isExpanded = (faultId: string) => toggled[faultId] ?? faultId === focusId;

  useEffect(() => {
    if (!focusId) return;
    document
      .getElementById(`fault-anchor-${focusId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId]);

  const all = useMemo<VehicleFault[]>(() => {
    const seen = new Set(activeFaults.map((f) => f.id));
    return [...activeFaults, ...faultHistory.filter((f) => !seen.has(f.id))];
  }, [activeFaults, faultHistory]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((fault) => {
        if (severity !== 'all' && fault.severity !== severity) return false;
        if (subsystem !== 'all' && fault.subsystem !== subsystem) return false;
        if (statusFilter === 'active' && fault.status === 'resolved') return false;
        if (statusFilter === 'acknowledged' && fault.status !== 'acknowledged') return false;
        if (statusFilter === 'resolved' && fault.status !== 'resolved') return false;
        if (needle.length > 0) {
          const haystack =
            `${fault.code} ${fault.title} ${fault.description} ${SUBSYSTEM_LABEL[fault.subsystem]}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort(compareSeverityDesc);
  }, [all, severity, subsystem, statusFilter, query]);

  const unresolved = activeFaults.filter((f) => f.status !== 'resolved');
  const counts = SEVERITIES.map((level) => ({
    level,
    count: unresolved.filter((f) => f.severity === level).length,
  })).filter((entry) => entry.count > 0);

  const filtersApplied =
    severity !== 'all' || subsystem !== 'all' || statusFilter !== 'active' || query.length > 0;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-header__title">Active faults and diagnostics</h1>
        <p className="page-header__description">
          Every fault the vehicle controller has reported, what it usually means, and what to check.
        </p>
      </header>

      <div className="row">
        <StatusPill tone={unresolved.length > 0 ? 'warning' : 'normal'}>
          {unresolved.length} active {pluralise(unresolved.length, 'fault')}
        </StatusPill>
        {counts.map(({ level, count }) => (
          <StatusPill key={level} tone={level === 'information' ? 'information' : level}>
            {count} {SEVERITY_LABEL[level].toLowerCase()}
          </StatusPill>
        ))}
        <StatusPill tone="offline" icon="clock">
          {faultHistory.length} in history
        </StatusPill>
      </div>

      <Banner tone="info">
        Faults are detected by the STM32 vehicle controller. This app shows what the controller
        reported — it does not detect faults itself and cannot clear them.
      </Banner>

      <div className="filter-bar">
        <div className="field" style={{ flex: '2 1 260px' }}>
          <label className="field__label" htmlFor="fault-search">
            Search by code or description
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="fault-search"
              className="input"
              type="search"
              placeholder="e.g. INV_OVER_TEMP or temperature"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-muted)',
                pointerEvents: 'none',
              }}
            >
              <Icon name="search" size={17} />
            </span>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-severity">
            Severity
          </label>
          <select
            id="filter-severity"
            className="select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | 'all')}
          >
            <option value="all">All severities</option>
            {SEVERITIES.map((level) => (
              <option key={level} value={level}>
                {SEVERITY_LABEL[level]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-subsystem">
            Subsystem
          </label>
          <select
            id="filter-subsystem"
            className="select"
            value={subsystem}
            onChange={(event) => setSubsystem(event.target.value as Subsystem | 'all')}
          >
            <option value="all">All subsystems</option>
            {SUBSYSTEMS.map((item) => (
              <option key={item} value={item}>
                {SUBSYSTEM_LABEL[item]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="active">Active and acknowledged</option>
            <option value="acknowledged">Acknowledged only</option>
            <option value="resolved">Resolved history</option>
            <option value="all">Everything</option>
          </select>
        </div>

        {filtersApplied ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setSeverity('all');
              setSubsystem('all');
              setStatusFilter('active');
              setQuery('');
              setSearchParams({}, { replace: true });
            }}
          >
            <Icon name="refresh" size={15} />
            Reset filters
          </button>
        ) : null}
      </div>

      <p className="muted" aria-live="polite">
        Showing {filtered.length} {pluralise(filtered.length, 'fault')}
        {filtersApplied ? ' after filtering' : ''}.
      </p>

      {loading ? (
        <StateBlock title="Loading faults…" busy />
      ) : filtered.length === 0 ? (
        <StateBlock
          icon={filtersApplied ? 'filter' : 'check-circle'}
          title={filtersApplied ? 'No faults match these filters' : 'No faults reported'}
        >
          <p>
            {filtersApplied
              ? 'Try a wider severity or subsystem, or switch the status filter to “Everything”.'
              : 'The vehicle controller has not reported any faults since this session started.'}
          </p>
        </StateBlock>
      ) : (
        <div className="stack">
          {filtered.map((fault) => (
            <div key={fault.id} id={`fault-anchor-${fault.id}`}>
              <FaultCard
                fault={fault}
                now={now}
                expanded={isExpanded(fault.id)}
                onToggle={() =>
                  setToggled((previous) => ({
                    ...previous,
                    [fault.id]: !isExpanded(fault.id),
                  }))
                }
                onAcknowledge={fault.severity === 'emergency' ? undefined : acknowledgeFault}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
