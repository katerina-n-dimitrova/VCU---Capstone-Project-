/**
 * DEMO CONTROLS — DEVELOPMENT ONLY
 *
 * This panel exists so the interface can be shown and tested before the STM32,
 * ESP32, CAN bus and sensors are ready. It only ever talks to the mock service.
 *
 * It renders nothing at all when:
 *   - the live data service is in use (there is no simulation to drive), or
 *   - `VITE_SIMULATION_CONTROLS=false`, which is the default for a production
 *     build, so the build flashed to the ESP32 has no demo controls in it.
 *
 * It sends nothing to the vehicle. Even in mock mode, this app never commands
 * anything — see the safety boundary in the README.
 */

import { useEffect, useState } from 'react';
import { SIMULATION_CONTROLS_ENABLED } from '../config/endpoints';
import { useVehicleData } from '../state/vehicleContext';
import { Icon } from '../components/common/Icon';
import { StatusPill } from '../components/common/StatusPill';
import type { ScenarioId } from '../services/VehicleDataService';

export function SimulationPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { simulation } = useVehicleData();
  const [active, setActive] = useState<ScenarioId>(() => simulation?.getScenario() ?? 'normal');
  const [paused, setPaused] = useState(() => simulation?.isPaused() ?? false);

  useEffect(() => simulation?.subscribe(setActive), [simulation]);

  if (!simulation || !SIMULATION_CONTROLS_ENABLED) return null;

  const current = simulation.scenarios.find((s) => s.id === active);

  return (
    <details className="demo-panel" open={defaultOpen}>
      <summary className="demo-panel__summary">
        <Icon name="flask" size={18} />
        Demo controls — simulated data only
        <span style={{ marginLeft: 'auto' }}>
          <StatusPill tone="demo">{current?.label ?? 'Normal operation'}</StatusPill>
        </span>
      </summary>

      <div className="demo-panel__body">
        <p className="muted">
          These controls are not part of the technician interface. They drive the built-in
          simulator so each fault state can be demonstrated without hardware. They send nothing to
          a vehicle, and they are excluded from a production build by default.
        </p>

        <div className="row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              simulation.setPaused(!paused);
              setPaused(!paused);
            }}
          >
            <Icon name={paused ? 'play' : 'pause'} size={15} />
            {paused ? 'Resume the simulated stream' : 'Freeze the simulated stream'}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => simulation.reset()}
            disabled={active === 'normal'}
          >
            <Icon name="refresh" size={15} />
            Back to normal operation
          </button>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ paddingBottom: 'var(--space-2)' }}>
            Simulate a condition
          </legend>
          <div className="scenario-grid">
            {simulation.scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className="scenario-button"
                aria-pressed={active === scenario.id}
                onClick={() => simulation.setScenario(scenario.id)}
              >
                <span className="scenario-button__label">
                  {scenario.label}
                  {active === scenario.id ? <span className="sr-only"> (running)</span> : null}
                </span>
                <span className="scenario-button__hint">{scenario.expectation}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Faults take about a second and a half to appear, the same way the STM32 debounces a
          condition before reporting it.
        </p>
      </div>
    </details>
  );
}
