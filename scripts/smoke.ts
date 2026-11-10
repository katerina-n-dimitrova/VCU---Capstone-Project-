/**
 * Headless check of the mock data service and every simulated fault scenario.
 *
 * Run with: npm run smoke
 *
 * It exercises the same code the UI uses — the service, the fault catalogue,
 * the measurement resolver and the history store — without a browser.
 */

import { MockVehicleDataService } from '../src/services/MockVehicleDataService';
import type { ScenarioId, VehicleDataEvent } from '../src/services/VehicleDataService';
import { HistoryStore } from '../src/state/history';
import { MEASUREMENT_IDS } from '../src/config/measurements';
import { resolveMeasurement } from '../src/utils/measurement';
import { deriveOverallStatus } from '../src/utils/status';
import type { VehicleStatus } from '../src/types/vehicle';

interface Expectation {
  scenario: ScenarioId;
  /** Fault code that must be raised. null means "no fault at all". */
  code: string | null;
  check?: (status: VehicleStatus) => string | null;
}

const EXPECTATIONS: Expectation[] = [
  { scenario: 'normal', code: null },
  { scenario: 'lowBatteryVoltage', code: 'BATT_UNDER_VOLT' },
  { scenario: 'batteryOvercurrent', code: 'BATT_OVER_CURRENT' },
  { scenario: 'inverterOverheat', code: 'INV_OVER_TEMP' },
  { scenario: 'mcuOverheat', code: 'MCU_OVER_TEMP' },
  { scenario: 'phaseImbalance', code: 'PHASE_IMBALANCE' },
  {
    scenario: 'sensorDisconnect',
    code: 'SENSOR_DISCONNECT',
    check: (status) =>
      status.battery.currentA === null
        ? null
        : `battery current should be null when the sensor is disconnected, got ${status.battery.currentA}`,
  },
  {
    scenario: 'canLoss',
    code: 'CAN_COMM_LOSS',
    check: (status) => {
      if (status.communication.canConnected) return 'canConnected should be false';
      const nonNull = MEASUREMENT_IDS.filter((id) => {
        const value = {
          batteryVoltage: status.battery.voltageV,
          batteryCurrent: status.battery.currentA,
          stateOfCharge: status.battery.stateOfChargePercent,
          inputDuty: status.inputDuty,
          phaseCurrentA: status.phaseCurrentA.phaseA,
          phaseCurrentB: status.phaseCurrentA.phaseB,
          phaseCurrentC: status.phaseCurrentA.phaseC,
          inverterTemperature: status.temperatureC.inverter,
          mcuTemperature: status.temperatureC.mcu,
        }[id];
        return value !== null;
      });
      return nonNull.length === 0
        ? null
        : `every measurement should be null after CAN loss, but these were not: ${nonNull.join(', ')}`;
    },
  },
  {
    scenario: 'gnssLoss',
    code: 'GNSS_SIGNAL_LOSS',
    check: (status) => {
      if (status.location.valid) return 'location.valid should be false';
      if (status.location.latitude === null) return 'the last known latitude should be kept';
      return null;
    },
  },
  {
    scenario: 'prechargeTimeout',
    code: 'PRECHARGE_TIMEOUT',
    check: (status) =>
      status.operatingState === 'fault' ? null : `operatingState should be "fault", got "${status.operatingState}"`,
  },
];

const failures: string[] = [];
const notes: string[] = [];

function check(condition: boolean, message: string) {
  if (condition) notes.push(`  ok    ${message}`);
  else failures.push(`  FAIL  ${message}`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll until a condition holds. Scenarios ramp in over several seconds and the
 * simulated STM32 debounces before reporting, so a fixed sleep is either slow
 * or flaky; this is both faster and deterministic.
 */
async function waitFor(
  condition: () => boolean,
  timeoutMs: number,
  intervalMs = 250,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await wait(intervalMs);
  }
  return condition();
}

async function main() {
  const service = new MockVehicleDataService();
  const history = new HistoryStore();
  for (const id of MEASUREMENT_IDS) history.seed(id, service.seedHistory(id));

  let latest: VehicleStatus | null = null;
  const newFaults: string[] = [];
  const resolvedFaults: string[] = [];
  let statusEvents = 0;

  service.subscribe((event: VehicleDataEvent) => {
    if (event.type === 'status') {
      latest = event.status;
      statusEvents += 1;
      history.record(event.measurements, Date.parse(event.status.timestamp));
    }
    if (event.type === 'fault:new') newFaults.push(event.fault.code);
    if (event.type === 'fault:resolved') resolvedFaults.push(event.fault.code);
  });

  console.log('Seeded history');
  for (const id of MEASUREMENT_IDS) {
    const stats = history.stats(id, 0);
    check(stats.count > 500, `${id}: backfilled ${stats.count} points`);
  }

  await service.start();
  await wait(1200);
  check(statusEvents > 2, `status frames arriving (${statusEvents} in the first second)`);

  const initial = await service.fetchStatus();
  check(initial.vehicleId.length > 0, `vehicle id present (${initial.vehicleId})`);
  check(
    (await service.fetchFaultHistory()).length >= 3,
    'resolved fault history is seeded',
  );

  for (const expectation of EXPECTATIONS) {
    // Settle back to normal first. Without this the suite is order-dependent:
    // the overcurrent scenario leaves the inverter hot, which would make the
    // next scenario's starting point depend on the one before it.
    service.simulation.setScenario('normal');
    const settled = await waitFor(
      () => (latest as VehicleStatus | null)?.activeFaults.length === 0,
      20000,
    );
    check(settled, `${expectation.scenario}: state settled to no faults before starting`);

    newFaults.length = 0;
    service.simulation.setScenario(expectation.scenario);

    if (expectation.code === null) {
      await wait(2500);
    } else {
      await waitFor(
        () =>
          (latest as VehicleStatus | null)?.activeFaults.some(
            (f) => f.code === expectation.code,
          ) ?? false,
        25000,
      );
    }

    const status = latest as VehicleStatus | null;
    if (!status) {
      failures.push(`  FAIL  ${expectation.scenario}: no status frame received`);
      continue;
    }

    const active = status.activeFaults.map((f) => f.code);
    console.log(`\n${expectation.scenario} → faults: ${active.join(', ') || '(none)'}`);

    if (expectation.code === null) {
      check(active.length === 0, `${expectation.scenario}: no faults raised`);
    } else {
      check(
        active.includes(expectation.code),
        `${expectation.scenario}: raised ${expectation.code}`,
      );
      const fault = status.activeFaults.find((f) => f.code === expectation.code);
      if (fault) {
        check(fault.possibleCauses.length >= 3, `${expectation.code}: has possible causes`);
        check(
          fault.recommendedActions.length >= 3,
          `${expectation.code}: has recommended actions`,
        );
        check(fault.detectedAt.includes('T'), `${expectation.code}: detectedAt is ISO-8601`);
      }
    }

    const problem = expectation.check?.(status);
    check(problem === null || problem === undefined, `${expectation.scenario}: ${problem ?? 'state is as expected'}`);

    // The overall roll-up must never claim "normal" while a critical fault stands.
    const overall = deriveOverallStatus(status, true);
    if (status.activeFaults.some((f) => f.severity === 'critical' || f.severity === 'emergency')) {
      check(
        overall.status === 'critical',
        `${expectation.scenario}: overall status is critical, got ${overall.status}`,
      );
    }
  }

  // Back to normal: the faults must clear again.
  service.simulation.reset();
  await waitFor(() => (latest as VehicleStatus | null)?.activeFaults.length === 0, 20000);
  const cleared = (latest as VehicleStatus | null)?.activeFaults ?? [];
  check(cleared.length === 0, `faults clear when conditions return to normal (${cleared.length} left)`);
  check(resolvedFaults.length > 0, `resolution events emitted (${resolvedFaults.length})`);

  // A missing value stays missing all the way through the resolver.
  const missing = resolveMeasurement(
    'batteryCurrent',
    { id: 'batteryCurrent', value: null, rawValue: null, sampledAt: null, receivedAt: null, quality: 'missing' },
    Date.now(),
  );
  check(missing.value === null, 'a missing measurement resolves to null, not 0');
  check(missing.band === 'unavailable', 'a missing measurement has no status band');

  // Staleness is detected from the timestamp alone.
  const stale = resolveMeasurement(
    'batteryVoltage',
    {
      id: 'batteryVoltage',
      value: 72,
      rawValue: 2880,
      sampledAt: new Date(Date.now() - 9000).toISOString(),
      receivedAt: new Date(Date.now() - 9000).toISOString(),
      quality: 'valid',
    },
    Date.now(),
  );
  check(stale.stale, 'an old reading is reported as stale');
  check(stale.value === 72, 'a stale reading keeps its last value');

  // Offline roll-up.
  const offline = deriveOverallStatus(latest, false);
  check(offline.status === 'offline', 'no link reads as offline, whatever the data says');

  service.stop();

  console.log('\n--- results ---');
  for (const note of notes) console.log(note);
  for (const failure of failures) console.log(failure);
  console.log(
    `\n${notes.length} passed, ${failures.length} failed`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
