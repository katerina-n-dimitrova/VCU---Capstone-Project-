/**
 * The measurement catalogue.
 *
 * One entry per signal the ESP32 forwards from the STM32. Everything the UI
 * shows about a measurement — plain-language name, technical name, unit, CAN
 * identifier, source component, staleness timeout, chart colour slot — comes
 * from here, so adding a signal is a single-file change.
 *
 * Threshold numbers themselves live in `thresholds.ts` (placeholder values).
 */

import type { MeasurementId } from '../types/vehicle';
import { SYSTEM_LIMITS, THRESHOLDS, type ThresholdSet } from './thresholds';

/** Chart colour slots, validated for colour-vision deficiency. See README. */
export type SeriesSlot = 1 | 2 | 3;

export interface MeasurementDescriptor {
  id: MeasurementId;
  /** Plain language, for drivers and the simple view. */
  label: string;
  /** Engineering name, for the technical view. */
  technicalLabel: string;
  /** Signal identifier as used in the CAN database / STM32 source. */
  signal: string;
  /** CAN frame that carries the signal. */
  canId: string;
  /** Component that produces the value. */
  sourceComponent: string;
  /** Short source string for the live-data table. */
  source: string;
  unit: string;
  /** Spoken unit, used for screen-reader labels. */
  unitSpoken: string;
  decimals: number;
  thresholds: ThresholdSet;
  /** A value older than this is shown with a stale-data warning. */
  staleAfterMs: number;
  /** How often the signal is expected on the bus. */
  expectedIntervalMs: number;
  /** Raw-to-engineering scaling, shown in the technical view. */
  scaling: { factor: number; offset: number; rawUnit: string };
  /** Whether the Analysis page charts this measurement. */
  chartable: boolean;
  /** Colour slot when the measurement appears in a multi-series chart. */
  seriesSlot: SeriesSlot;
  /** Line dash pattern — secondary encoding so colour is never the only cue. */
  dashPattern: string | undefined;
  /** One-line explanation for the expandable help text. */
  help: string;
}

const RATE_20HZ = 50;
const RATE_10HZ = 100;
const RATE_2HZ = 500;

export const MEASUREMENTS: Record<MeasurementId, MeasurementDescriptor> = {
  batteryVoltage: {
    id: 'batteryVoltage',
    label: 'Battery voltage',
    technicalLabel: 'Pack terminal voltage',
    signal: 'BATT_V',
    canId: '0x120',
    sourceComponent: 'STM32 · pack voltage divider (ADC1_IN4)',
    source: 'STM32 / ADC1',
    unit: 'V',
    unitSpoken: 'volts',
    decimals: 1,
    thresholds: THRESHOLDS.batteryVoltage,
    staleAfterMs: 1000,
    expectedIntervalMs: RATE_10HZ,
    scaling: { factor: 0.025, offset: 0, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 1,
    dashPattern: undefined,
    help: 'Voltage measured at the battery terminals. It sags under heavy load and recovers when the vehicle coasts.',
  },
  batteryCurrent: {
    id: 'batteryCurrent',
    label: 'Battery current',
    technicalLabel: 'Pack current (positive = discharge)',
    signal: 'BATT_I',
    canId: '0x120',
    sourceComponent: 'STM32 · pack shunt amplifier (ADC1_IN5)',
    source: 'STM32 / ADC1',
    unit: 'A',
    unitSpoken: 'amps',
    decimals: 1,
    thresholds: THRESHOLDS.batteryCurrent,
    staleAfterMs: 1000,
    expectedIntervalMs: RATE_10HZ,
    scaling: { factor: 0.05, offset: -1600, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 2,
    dashPattern: '6 3',
    help: 'Current flowing out of the battery. Negative values mean the battery is being charged, for example during regenerative braking.',
  },
  stateOfCharge: {
    id: 'stateOfCharge',
    label: 'Estimated charge left',
    technicalLabel: 'State of charge (estimated)',
    signal: 'BATT_SOC',
    canId: '0x121',
    sourceComponent: 'STM32 · coulomb counter estimate',
    source: 'STM32 / estimator',
    unit: '%',
    unitSpoken: 'percent',
    decimals: 0,
    thresholds: THRESHOLDS.stateOfCharge,
    staleAfterMs: 3000,
    expectedIntervalMs: RATE_2HZ,
    scaling: { factor: 0.5, offset: 0, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 3,
    dashPattern: '2 3',
    help: 'An estimate, not a direct measurement. Treat it as a guide rather than an exact figure.',
  },
  inputDuty: {
    id: 'inputDuty',
    label: 'Throttle input',
    technicalLabel: 'Inverter input duty cycle',
    signal: 'IN_DUTY',
    canId: '0x130',
    sourceComponent: 'STM32 · throttle input capture (TIM3_CH1)',
    source: 'STM32 / TIM3',
    unit: '%',
    unitSpoken: 'percent',
    decimals: 1,
    thresholds: THRESHOLDS.inputDuty,
    staleAfterMs: 500,
    expectedIntervalMs: RATE_20HZ,
    scaling: { factor: 0.1, offset: 0, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 1,
    dashPattern: undefined,
    help: 'How far the throttle is being applied, as commanded to the inverter.',
  },
  phaseCurrentA: {
    id: 'phaseCurrentA',
    label: 'Motor phase A current',
    technicalLabel: 'Phase A RMS current',
    signal: 'PH_A_I',
    canId: '0x131',
    sourceComponent: 'STM32 · phase A shunt (ADC2_IN1)',
    source: 'STM32 / ADC2',
    unit: 'A',
    unitSpoken: 'amps',
    decimals: 1,
    thresholds: THRESHOLDS.phaseCurrent,
    staleAfterMs: 500,
    expectedIntervalMs: RATE_20HZ,
    scaling: { factor: 0.05, offset: -1600, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 1,
    dashPattern: undefined,
    help: 'Current in one of the three motor windings. The three phases should stay close to each other.',
  },
  phaseCurrentB: {
    id: 'phaseCurrentB',
    label: 'Motor phase B current',
    technicalLabel: 'Phase B RMS current',
    signal: 'PH_B_I',
    canId: '0x131',
    sourceComponent: 'STM32 · phase B shunt (ADC2_IN2)',
    source: 'STM32 / ADC2',
    unit: 'A',
    unitSpoken: 'amps',
    decimals: 1,
    thresholds: THRESHOLDS.phaseCurrent,
    staleAfterMs: 500,
    expectedIntervalMs: RATE_20HZ,
    scaling: { factor: 0.05, offset: -1600, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 2,
    dashPattern: '6 3',
    help: 'Current in one of the three motor windings. The three phases should stay close to each other.',
  },
  phaseCurrentC: {
    id: 'phaseCurrentC',
    label: 'Motor phase C current',
    technicalLabel: 'Phase C RMS current',
    signal: 'PH_C_I',
    canId: '0x131',
    sourceComponent: 'STM32 · phase C shunt (ADC2_IN3)',
    source: 'STM32 / ADC2',
    unit: 'A',
    unitSpoken: 'amps',
    decimals: 1,
    thresholds: THRESHOLDS.phaseCurrent,
    staleAfterMs: 500,
    expectedIntervalMs: RATE_20HZ,
    scaling: { factor: 0.05, offset: -1600, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 3,
    dashPattern: '2 3',
    help: 'Current in one of the three motor windings. The three phases should stay close to each other.',
  },
  inverterTemperature: {
    id: 'inverterTemperature',
    label: 'Inverter temperature',
    technicalLabel: 'Inverter heatsink temperature',
    signal: 'INV_TEMP',
    canId: '0x140',
    sourceComponent: 'STM32 · NTC on inverter heatsink (ADC3_IN1)',
    source: 'STM32 / ADC3',
    unit: '°C',
    unitSpoken: 'degrees Celsius',
    decimals: 1,
    thresholds: THRESHOLDS.inverterTemperature,
    staleAfterMs: 3000,
    expectedIntervalMs: RATE_2HZ,
    scaling: { factor: 0.1, offset: -400, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 2,
    dashPattern: '6 3',
    help: 'Temperature of the power electronics that drive the motor. It rises with load and with poor airflow.',
  },
  mcuTemperature: {
    id: 'mcuTemperature',
    label: 'Controller temperature',
    technicalLabel: 'STM32 die temperature',
    signal: 'MCU_TEMP',
    canId: '0x140',
    sourceComponent: 'STM32 · internal temperature sensor',
    source: 'STM32 / internal',
    unit: '°C',
    unitSpoken: 'degrees Celsius',
    decimals: 1,
    thresholds: THRESHOLDS.mcuTemperature,
    staleAfterMs: 3000,
    expectedIntervalMs: RATE_2HZ,
    scaling: { factor: 0.1, offset: -400, rawUnit: 'counts' },
    chartable: true,
    seriesSlot: 1,
    dashPattern: undefined,
    help: 'Temperature of the main control board itself. A high reading usually points to the enclosure rather than the motor.',
  },
};

export const MEASUREMENT_IDS = Object.keys(MEASUREMENTS) as MeasurementId[];

export const CHARTABLE_MEASUREMENT_IDS = MEASUREMENT_IDS.filter(
  (id) => MEASUREMENTS[id].chartable,
);

export function measurement(id: MeasurementId): MeasurementDescriptor {
  return MEASUREMENTS[id];
}

/** Effective staleness timeout for a measurement. */
export function staleTimeoutMs(id: MeasurementId): number {
  return MEASUREMENTS[id].staleAfterMs || SYSTEM_LIMITS.defaultMeasurementStaleMs;
}

/** Comparison groups offered on the Analysis page. Same-unit groups only. */
export interface ComparisonGroup {
  id: string;
  label: string;
  description: string;
  /** Measurements sharing one y-axis. Never two different units on one axis. */
  members: MeasurementId[][];
}

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    id: 'battery',
    label: 'Battery voltage and current',
    description:
      'Voltage and current use different units, so they are drawn as two charts that share one time axis. A voltage dip at the same moment as a current spike points at pack resistance or a loose connection.',
    members: [['batteryVoltage'], ['batteryCurrent']],
  },
  {
    id: 'phases',
    label: 'Three phase currents',
    description:
      'All three phases share one axis because they share a unit. Healthy phases track each other closely.',
    members: [['phaseCurrentA', 'phaseCurrentB', 'phaseCurrentC']],
  },
  {
    id: 'temperatures',
    label: 'Inverter and controller temperature',
    description:
      'Both are in °C, so they share one axis. If only the inverter climbs, look at its cooling. If both climb together, look at the enclosure.',
    members: [['inverterTemperature', 'mcuTemperature']],
  },
  {
    id: 'drive',
    label: 'Throttle input and charge level',
    description:
      'Two different units, drawn as two charts on one time axis, so heavy use can be lined up against the charge estimate.',
    members: [['inputDuty'], ['stateOfCharge']],
  },
];
