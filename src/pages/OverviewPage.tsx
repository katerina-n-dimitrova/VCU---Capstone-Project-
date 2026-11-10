import { Link } from 'react-router-dom';
import { useVehicleData } from '../state/vehicleContext';
import { MetricTile } from '../components/common/MetricTile';
import { StatusBanner } from '../components/common/StatusBanner';
import { Card } from '../components/common/Card';
import { StatusPill } from '../components/common/StatusPill';
import { SeverityIcon } from '../components/common/SeverityIcon';
import { Icon } from '../components/common/Icon';
import { Banner } from '../components/common/Banner';
import { Disclosure } from '../components/common/Disclosure';
import { LoadingBlock } from '../components/common/StateBlock';
import { SimulationPanel } from '../dev/SimulationPanel';
import {
  OPERATING_STATE_HELP,
  OPERATING_STATE_LABEL,
  SEVERITY_LABEL,
  SUBSYSTEM_LABEL,
  compareSeverityDesc,
} from '../utils/status';
import { formatLatLonHuman, formatNumber, pluralise } from '../utils/format';
import { formatAge, formatClockSeconds, formatDateTime, formatDuration } from '../utils/time';

export function OverviewPage() {
  const { status, measurements, loading, now, activeFaults, overall, connection, simulated } =
    useVehicleData();

  if (loading || !status) {
    return (
      <div className="page">
        <PageHeading />
        <LoadingBlock what="the vehicle overview" />
      </div>
    );
  }

  const unresolved = [...activeFaults]
    .filter((fault) => fault.status !== 'resolved')
    .sort(compareSeverityDesc);
  const comms = status.communication;
  const location = status.location;

  return (
    <div className="page">
      <PageHeading />

      {simulated ? (
        <Banner tone="demo">
          <strong>Simulated data.</strong> No vehicle is connected. Every reading and fault on this
          screen is generated for development and demonstration.
        </Banner>
      ) : null}

      <StatusBanner status={overall.status} headline={overall.headline} detail={overall.detail}>
        <div className="row">
          <StatusPill
            tone={
              status.operatingState === 'fault'
                ? 'critical'
                : status.operatingState === 'limited'
                  ? 'warning'
                  : status.operatingState === 'off'
                    ? 'offline'
                    : 'normal'
            }
            icon="gauge"
            title={OPERATING_STATE_HELP[status.operatingState]}
          >
            {OPERATING_STATE_LABEL[status.operatingState]}
          </StatusPill>
          <StatusPill tone={unresolved.length > 0 ? 'warning' : 'normal'} icon="alert-triangle">
            {unresolved.length} active {pluralise(unresolved.length, 'fault')}
          </StatusPill>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Last update {formatAge(status.timestamp, now)} ({formatClockSeconds(status.timestamp)})
          </span>
        </div>
      </StatusBanner>

      {unresolved.length > 0 ? (
        <Card
          title="Needs attention"
          titleId="needs-attention"
          subtitle={`${unresolved.length} ${pluralise(unresolved.length, 'fault')} reported by the vehicle controller`}
          action={
            <Link className="btn btn--sm" to="/faults">
              All faults
              <Icon name="chevron-right" size={15} />
            </Link>
          }
        >
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
            {unresolved.slice(0, 3).map((fault) => (
              <li key={fault.id}>
                <Link
                  to={`/faults?fault=${encodeURIComponent(fault.id)}`}
                  className="fault-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <SeverityIcon severity={fault.severity} size={20} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 650, display: 'block' }}>{fault.title}</span>
                    <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                      {SEVERITY_LABEL[fault.severity]} · {SUBSYSTEM_LABEL[fault.subsystem]} ·
                      detected {formatAge(fault.detectedAt, now)}
                    </span>
                  </span>
                  {fault.requiresImmediateShutdown ? (
                    <StatusPill tone="critical">Stop the vehicle</StatusPill>
                  ) : fault.vehicleCanContinue ? (
                    <StatusPill tone="normal">Can keep driving</StatusPill>
                  ) : (
                    <StatusPill tone="warning">Do not drive</StatusPill>
                  )}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
          {unresolved.length > 3 ? (
            <p className="muted">
              {unresolved.length - 3} more {pluralise(unresolved.length - 3, 'fault')} on the
              faults page.
            </p>
          ) : null}
        </Card>
      ) : null}

      <section aria-labelledby="key-readings">
        <h2 id="key-readings" className="card__title" style={{ marginBottom: 'var(--space-3)' }}>
          Key readings
        </h2>
        <div className="grid">
          <MetricTile id="stateOfCharge" sample={measurements?.stateOfCharge} now={now} />
          <MetricTile id="batteryVoltage" sample={measurements?.batteryVoltage} now={now} />
          <MetricTile id="batteryCurrent" sample={measurements?.batteryCurrent} now={now} />
          <MetricTile id="inverterTemperature" sample={measurements?.inverterTemperature} now={now} />
        </div>
      </section>

      <section aria-labelledby="other-readings">
        <h2 id="other-readings" className="card__title" style={{ marginBottom: 'var(--space-3)' }}>
          Other readings
        </h2>
        <div className="grid grid--tight">
          <MetricTile id="inputDuty" sample={measurements?.inputDuty} now={now} showRange={false} />
          <MetricTile id="mcuTemperature" sample={measurements?.mcuTemperature} now={now} showRange={false} />
          <MetricTile id="phaseCurrentA" sample={measurements?.phaseCurrentA} now={now} showRange={false} />
          <MetricTile id="phaseCurrentB" sample={measurements?.phaseCurrentB} now={now} showRange={false} />
          <MetricTile id="phaseCurrentC" sample={measurements?.phaseCurrentC} now={now} showRange={false} />
        </div>
        <p className="muted" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <Link to="/live">Open Live Data</Link> for every measurement with its source and update
          time, or <Link to="/analysis">Analysis</Link> to see how these have changed.
        </p>
      </section>

      <div className="grid grid--wide">
        <Card title="Connection" titleId="overview-connection">
          <dl className="detail-list">
            <StatusItem label="Vehicle controller (STM32)" ok={comms.stm32Connected} okText="Connected" badText="Not responding" />
            <StatusItem label="Connectivity board (ESP32)" ok={comms.esp32Connected} okText="Connected" badText="Not connected" />
            <StatusItem label="CAN bus" ok={comms.canConnected} okText="Receiving" badText="No messages" />
            <StatusItem label="GNSS" ok={comms.gnssConnected} okText="Signal" badText="No signal" neutralWhenBad />
            <div className="detail-list__item">
              <dt className="detail-list__term">Last CAN message</dt>
              <dd className="detail-list__value">{formatAge(comms.lastCanMessageAt, now)}</dd>
            </div>
            <div className="detail-list__item">
              <dt className="detail-list__term">Vehicle uptime</dt>
              <dd className="detail-list__value">{formatDuration(status.uptimeSeconds)}</dd>
            </div>
          </dl>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {connection.detail}
          </p>
          <Link className="btn btn--sm" to="/system">
            <Icon name="server" size={15} />
            System status in detail
          </Link>
        </Card>

        <Card title="Location" titleId="overview-location">
          {location.valid && location.latitude !== null && location.longitude !== null ? (
            <>
              <p style={{ fontWeight: 650 }}>{formatLatLonHuman(location.latitude, location.longitude)}</p>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Updated {formatAge(location.timestamp, now)}
                {location.accuracyMeters !== null
                  ? ` · accurate to about ${location.accuracyMeters} m`
                  : ''}
              </p>
              <StatusPill tone="normal" icon="map-pin">
                Position is current
              </StatusPill>
            </>
          ) : (
            <>
              <StatusPill tone="offline" icon="map-pin">
                Position unavailable
              </StatusPill>
              <p>
                Location is unavailable because the GNSS module does not have a valid signal.
                {location.timestamp
                  ? ` The last known position was recorded ${formatAge(location.timestamp, now)}.`
                  : ''}
              </p>
            </>
          )}
          <Link className="btn btn--sm" to="/location">
            <Icon name="map-pin" size={15} />
            Open the location page
          </Link>
        </Card>
      </div>

      <Disclosure summary="Technical summary of this frame">
        <dl className="detail-list">
          <div className="detail-list__item">
            <dt className="detail-list__term">Vehicle identifier</dt>
            <dd className="detail-list__value mono">{status.vehicleId}</dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">Frame timestamp</dt>
            <dd className="detail-list__value">{formatDateTime(status.timestamp)}</dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">Sequence number</dt>
            <dd className="detail-list__value mono">{status.sequenceNumber}</dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">Operating state</dt>
            <dd className="detail-list__value mono">{status.operatingState}</dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">Last CAN message</dt>
            <dd className="detail-list__value">
              {comms.lastCanMessageAt ? formatDateTime(comms.lastCanMessageAt) : 'None received'}
            </dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">CAN receive errors</dt>
            <dd className="detail-list__value">
              {comms.canReceiveErrorCount === null || comms.canReceiveErrorCount === undefined
                ? 'Not reported'
                : comms.canReceiveErrorCount}
            </dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">CAN bus load</dt>
            <dd className="detail-list__value">
              {comms.canBusLoadPercent === null || comms.canBusLoadPercent === undefined
                ? 'Not reported'
                : `${formatNumber(comms.canBusLoadPercent, 1)} %`}
            </dd>
          </div>
          <div className="detail-list__item">
            <dt className="detail-list__term">Data source</dt>
            <dd className="detail-list__value">
              {simulated ? 'Built-in simulator' : connection.endpoint}
            </dd>
          </div>
        </dl>
      </Disclosure>

      <SimulationPanel />
    </div>
  );
}

function PageHeading() {
  return (
    <header className="page-header">
      <h1 className="page-header__title">Vehicle overview</h1>
      <p className="page-header__description">
        How the vehicle is doing right now, and anything that needs attention.
      </p>
    </header>
  );
}

function StatusItem({
  label,
  ok,
  okText,
  badText,
  neutralWhenBad = false,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  neutralWhenBad?: boolean;
}) {
  return (
    <div className="detail-list__item">
      <dt className="detail-list__term">{label}</dt>
      <dd className="detail-list__value">
        <StatusPill tone={ok ? 'normal' : neutralWhenBad ? 'offline' : 'critical'}>
          {ok ? okText : badText}
        </StatusPill>
      </dd>
    </div>
  );
}
