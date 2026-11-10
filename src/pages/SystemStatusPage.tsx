import { useVehicleData } from '../state/vehicleContext';
import { Card } from '../components/common/Card';
import { Banner } from '../components/common/Banner';
import { StatusPill, type PillTone } from '../components/common/StatusPill';
import { StateBlock } from '../components/common/StateBlock';
import { Icon } from '../components/common/Icon';
import { SimulationPanel } from '../dev/SimulationPanel';
import { APP_INFO, DATA_SOURCE_MODE } from '../config/endpoints';
import { SYSTEM_LIMITS } from '../config/thresholds';
import type { ComponentState } from '../types/vehicle';
import { ageMs, formatAge, formatDateTime, formatDuration } from '../utils/time';

const STATE_TONE: Record<ComponentState, PillTone> = {
  ok: 'normal',
  degraded: 'warning',
  fault: 'critical',
  offline: 'offline',
  unknown: 'unavailable',
};

const STATE_WORD: Record<ComponentState, string> = {
  ok: 'Working',
  degraded: 'Working with a problem',
  fault: 'Faulty',
  offline: 'Not responding',
  unknown: 'Unknown',
};

export function SystemStatusPage() {
  const { system, status, connection, now, loading, simulated, lastError, refresh } =
    useVehicleData();

  if (loading || !system) {
    return (
      <div className="page">
        <Heading />
        <StateBlock title="Loading system status…" busy />
      </div>
    );
  }

  const canAge = ageMs(system.lastCanMessageAt, now);
  const canStale = canAge !== null && canAge > SYSTEM_LIMITS.canMessageStaleMs;

  return (
    <div className="page">
      <Heading />

      {simulated ? (
        <Banner tone="demo">
          <strong>Simulated system.</strong> No STM32 or ESP32 is connected. Versions, uptimes and
          counters below are generated.
        </Banner>
      ) : null}

      {lastError ? (
        <Banner tone="warning" role="status">
          <strong>Last communication problem:</strong> {lastError.message}{' '}
          <span className="muted">({formatAge(lastError.at, now)})</span>
        </Banner>
      ) : null}

      <section aria-labelledby="components-heading" className="stack">
        <h2 id="components-heading" className="card__title">
          Parts of the system
        </h2>
        <div className="grid grid--wide">
          {system.components.map((component) => (
            <article key={component.id} className="card">
              <div className="card__body">
                <div className="spread">
                  <h3 className="card__title">{component.label}</h3>
                  <StatusPill tone={STATE_TONE[component.state]}>
                    {STATE_WORD[component.state]}
                  </StatusPill>
                </div>
                <p>{component.explanation}</p>
                {component.detail ? (
                  <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {component.detail}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid--wide">
        <Card title="Communication" titleId="system-communication">
          {canStale ? (
            <Banner tone="warning">
              No CAN message has arrived for {formatAge(system.lastCanMessageAt, now)}. Readings on
              other pages are not current.
            </Banner>
          ) : null}
          <dl className="detail-list">
            <Item
              term="Last successful CAN message"
              value={
                system.lastCanMessageAt
                  ? `${formatAge(system.lastCanMessageAt, now)} (${formatDateTime(system.lastCanMessageAt)})`
                  : 'None received'
              }
            />
            <Item
              term="CAN receive errors"
              value={
                system.canReceiveErrorCount === null
                  ? 'Not reported by the device'
                  : String(system.canReceiveErrorCount)
              }
            />
            <Item
              term="CAN bus load"
              value={
                system.canBusLoadPercent === null
                  ? 'Not reported by the device'
                  : `${system.canBusLoadPercent} %`
              }
            />
            <Item term="App connection" value={connection.detail} />
            <Item term="Data source" value={simulated ? 'Built-in simulator' : connection.endpoint} />
            <Item
              term="Hotspot"
              value={
                system.hotspotSsid
                  ? `${system.hotspotSsid}${system.hotspotClients !== null ? ` · ${system.hotspotClients} connected` : ''}`
                  : 'Not reported'
              }
            />
          </dl>
          <button type="button" className="btn btn--sm" onClick={refresh}>
            <Icon name="refresh" size={15} />
            Reload from the device
          </button>
        </Card>

        <Card title="Versions and uptime" titleId="system-versions">
          <dl className="detail-list">
            <Item term="Vehicle" value={system.vehicleId} mono />
            <Item term="Application version" value={system.appVersion} mono />
            <Item
              term="STM32 firmware"
              value={system.stm32FirmwareVersion ?? 'Not reported — the controller is not responding'}
              mono={system.stm32FirmwareVersion !== null}
            />
            <Item
              term="ESP32 firmware"
              value={system.esp32FirmwareVersion ?? 'Not reported'}
              mono={system.esp32FirmwareVersion !== null}
            />
            <Item term="System uptime" value={formatDuration(system.systemUptimeSeconds)} />
            <Item
              term="ESP32 uptime"
              value={
                system.esp32UptimeSeconds === null
                  ? 'Not reported'
                  : formatDuration(system.esp32UptimeSeconds)
              }
            />
            <Item
              term="Vehicle uptime"
              value={status ? formatDuration(status.uptimeSeconds) : 'Unknown'}
            />
            <Item term="Data mode" value={DATA_SOURCE_MODE === 'mock' ? 'Mock (simulated)' : 'Live (ESP32)'} />
          </dl>
        </Card>
      </div>

      <Card title="What this application does and does not do" titleId="system-safety">
        <p>
          This application monitors and reports. The STM32 vehicle controller remains responsible
          for vehicle control, fault detection, safety decisions, torque limiting, emergency
          shutdown and contactor control.
        </p>
        <ul>
          <li>It displays the state and faults reported by the STM32.</li>
          <li>It does not decide whether the vehicle is safe.</li>
          <li>
            It cannot accelerate, brake, steer, change direction, operate contactors or command the
            motor.
          </li>
          <li>It cannot clear faults; that needs an authorised diagnostic tool.</li>
        </ul>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {APP_INFO.name} {system.appVersion}
        </p>
      </Card>

      <SimulationPanel />
    </div>
  );
}

function Heading() {
  return (
    <header className="page-header">
      <h1 className="page-header__title">System and connection status</h1>
      <p className="page-header__description">
        The state of each part of the system and the link between them.
      </p>
    </header>
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
