/**
 * Fault catalogue.
 *
 * In the finished system the STM32 owns fault detection and reports a code.
 * This file is the lookup table that turns a code into something a driver or a
 * technician can read: a plain-language title, likely causes, and inspection
 * steps. The flags `vehicleCanContinue` and `requiresImmediateShutdown` mirror
 * what the STM32 reports — the application never works them out for itself.
 *
 * The mock service also uses this table to raise realistic faults.
 */

import type {
  FaultClearingPolicy,
  MeasurementId,
  Severity,
  Subsystem,
  VehicleFault,
} from '../types/vehicle';
import { MEASUREMENTS } from '../config/measurements';
import { THRESHOLDS } from '../config/thresholds';

export type FaultCode =
  | 'BATT_UNDER_VOLT'
  | 'BATT_OVER_CURRENT'
  | 'INV_OVER_TEMP'
  | 'MCU_OVER_TEMP'
  | 'PHASE_IMBALANCE'
  | 'SENSOR_DISCONNECT'
  | 'CAN_COMM_LOSS'
  | 'GNSS_SIGNAL_LOSS'
  | 'PRECHARGE_TIMEOUT';

export interface FaultDefinition {
  code: FaultCode;
  title: string;
  /** Plain-language explanation of what happened, for notifications. */
  description: string;
  subsystem: Subsystem;
  severity: Severity;
  measurementId: MeasurementId | null;
  unit: string | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  normalRangeMin: number | null;
  normalRangeMax: number | null;
  possibleCauses: string[];
  recommendedActions: string[];
  /** What the driver should do right now, in one sentence. */
  driverAction: string;
  vehicleCanContinue: boolean;
  requiresImmediateShutdown: boolean;
  clearing: FaultClearingPolicy;
}

const battery = THRESHOLDS.batteryVoltage;
const current = THRESHOLDS.batteryCurrent;
const inverter = THRESHOLDS.inverterTemperature;
const mcu = THRESHOLDS.mcuTemperature;

export const FAULT_DEFINITIONS: Record<FaultCode, FaultDefinition> = {
  BATT_UNDER_VOLT: {
    code: 'BATT_UNDER_VOLT',
    title: 'Battery voltage is low',
    description:
      'The battery pack voltage has dropped below its normal operating range. The vehicle may lose power without warning.',
    subsystem: 'battery',
    severity: 'warning',
    measurementId: 'batteryVoltage',
    unit: 'V',
    warningThreshold: battery.warningLow,
    criticalThreshold: battery.criticalLow,
    normalRangeMin: battery.normalMin,
    normalRangeMax: battery.normalMax,
    possibleCauses: [
      'Battery is nearly empty and needs charging',
      'One or more cells in the pack have failed',
      'Loose or corroded pack terminal, causing voltage to sag under load',
      'Battery is too cold, which temporarily reduces available voltage',
      'Voltage sense wiring or divider is out of calibration',
    ],
    recommendedActions: [
      'Bring the vehicle to a safe stop and reduce load on the battery',
      'Check the state-of-charge estimate and charge the pack if it is low',
      'With the pack isolated, inspect the main terminals for looseness and corrosion',
      'Measure pack voltage at the terminals with a meter and compare with the reading shown here',
      'If the meter and the reading disagree by more than a volt, suspect the sense wiring',
    ],
    driverAction: 'Finish your trip if you can and charge the battery soon.',
    vehicleCanContinue: true,
    requiresImmediateShutdown: false,
    clearing: 'self-clearing',
  },

  BATT_OVER_CURRENT: {
    code: 'BATT_OVER_CURRENT',
    title: 'Battery is drawing too much current',
    description:
      'Current drawn from the battery pack has exceeded its approved limit. Sustained overcurrent overheats cells and wiring.',
    subsystem: 'battery',
    severity: 'critical',
    measurementId: 'batteryCurrent',
    unit: 'A',
    warningThreshold: current.warningHigh,
    criticalThreshold: current.criticalHigh,
    normalRangeMin: current.normalMin,
    normalRangeMax: current.normalMax,
    possibleCauses: [
      'Vehicle is overloaded or climbing a steep gradient',
      'Motor is stalled or mechanically jammed',
      'Short circuit or insulation failure in the motor or its cabling',
      'Inverter is commanding more current than it should',
      'Current sensor or shunt amplifier is reading high',
    ],
    recommendedActions: [
      'Stop the vehicle safely and switch off the drive system',
      'Check that the wheels and transmission turn freely by hand',
      'Reduce load and look for anything jammed in the drivetrain',
      'With the pack isolated, inspect motor and inverter cabling for damage or chafing',
      'Compare the shunt reading against a clamp meter before returning the vehicle to service',
    ],
    driverAction: 'Stop the vehicle safely and switch off the drive system.',
    vehicleCanContinue: false,
    requiresImmediateShutdown: true,
    clearing: 'authorized-tool-required',
  },

  INV_OVER_TEMP: {
    code: 'INV_OVER_TEMP',
    title: 'Inverter temperature is too high',
    description:
      'The inverter has risen above its approved operating temperature. Continuing to drive risks permanent damage to the power stage.',
    subsystem: 'inverter',
    severity: 'critical',
    measurementId: 'inverterTemperature',
    unit: '°C',
    warningThreshold: inverter.warningHigh,
    criticalThreshold: inverter.criticalHigh,
    normalRangeMin: inverter.normalMin,
    normalRangeMax: inverter.normalMax,
    possibleCauses: [
      'Cooling fan has stopped or is running slowly',
      'Heatsink fins are blocked with dust or debris',
      'Heatsink thermal paste has dried out or the mounting is loose',
      'Sustained heavy load, such as a long climb with a full load',
      'High ambient temperature with poor airflow around the enclosure',
    ],
    recommendedActions: [
      'Stop the vehicle safely and let the inverter cool before touching it',
      'Check that the cooling fan spins freely and runs when the system is powered',
      'Clear dust and debris from the heatsink and air path',
      'Check that the inverter is firmly mounted to its heatsink',
      'Re-check the temperature after cooling; if it climbs again quickly, do not return the vehicle to service',
    ],
    driverAction: 'Stop the vehicle safely and inspect the inverter cooling system.',
    vehicleCanContinue: false,
    requiresImmediateShutdown: true,
    clearing: 'authorized-tool-required',
  },

  MCU_OVER_TEMP: {
    code: 'MCU_OVER_TEMP',
    title: 'Controller board is running hot',
    description:
      'The main control board has risen above its normal temperature range. The controller may reduce power to protect itself.',
    subsystem: 'mcu',
    severity: 'warning',
    measurementId: 'mcuTemperature',
    unit: '°C',
    warningThreshold: mcu.warningHigh,
    criticalThreshold: mcu.criticalHigh,
    normalRangeMin: mcu.normalMin,
    normalRangeMax: mcu.normalMax,
    possibleCauses: [
      'Controller enclosure has no ventilation or its vents are blocked',
      'Enclosure is mounted in direct sun or next to the inverter heatsink',
      'Heat is conducting into the board from a nearby hot component',
      'A regulator on the board is dissipating more power than expected',
      'Internal temperature sensor is reading high',
    ],
    recommendedActions: [
      'Park in shade and allow the controller to cool',
      'Check that the enclosure vents are clear',
      'Check the mounting position and add separation from the inverter if they share a surface',
      'Inspect the board for discoloured or hot-running regulators',
      'Compare the reading against a probe on the enclosure before replacing anything',
    ],
    driverAction: 'Park in shade and let the controller cool down.',
    vehicleCanContinue: true,
    requiresImmediateShutdown: false,
    clearing: 'self-clearing',
  },

  PHASE_IMBALANCE: {
    code: 'PHASE_IMBALANCE',
    title: 'Motor phase currents are uneven',
    description:
      'The three motor phases are not carrying similar currents. This usually means a winding, connection or sensor problem, and it heats the motor unevenly.',
    subsystem: 'motor',
    severity: 'critical',
    measurementId: 'phaseCurrentB',
    unit: 'A',
    warningThreshold: THRESHOLDS.phaseCurrent.warningHigh,
    criticalThreshold: THRESHOLDS.phaseCurrent.criticalHigh,
    normalRangeMin: THRESHOLDS.phaseCurrent.normalMin,
    normalRangeMax: THRESHOLDS.phaseCurrent.normalMax,
    possibleCauses: [
      'Loose, corroded or burnt motor phase connector',
      'Partial short between turns in one motor winding',
      'Failed inverter half-bridge or gate driver on one phase',
      'One phase-current sensor has drifted or lost its supply',
      'Damaged phase cable between the inverter and the motor',
    ],
    recommendedActions: [
      'Stop the vehicle and switch off the drive system',
      'With the pack isolated, inspect all three phase connectors for heat damage and looseness',
      'Measure winding resistance phase-to-phase; the three readings should match closely',
      'Compare each phase-current sensor reading at zero current — all three should read near zero',
      'Do not return the vehicle to service until the three phases match',
    ],
    driverAction: 'Stop the vehicle safely and have the motor wiring inspected.',
    vehicleCanContinue: false,
    requiresImmediateShutdown: true,
    clearing: 'authorized-tool-required',
  },

  SENSOR_DISCONNECT: {
    code: 'SENSOR_DISCONNECT',
    title: 'A sensor is not responding',
    description:
      'The controller has stopped receiving readings from a sensor. The affected measurement is shown as unavailable rather than guessed.',
    subsystem: 'sensor',
    severity: 'warning',
    measurementId: 'batteryCurrent',
    unit: null,
    warningThreshold: null,
    criticalThreshold: null,
    normalRangeMin: null,
    normalRangeMax: null,
    possibleCauses: [
      'Sensor connector has vibrated loose',
      'Broken or chafed signal wire',
      'Sensor has lost its supply voltage',
      'Sensor itself has failed',
      'Analogue input on the STM32 has been damaged',
    ],
    recommendedActions: [
      'Identify the affected sensor from the Live Data page — it shows as unavailable',
      'Check the sensor connector is fully seated and locked',
      'Inspect the harness between the sensor and the controller for damage',
      'Check the supply voltage at the sensor connector',
      'Swap in a known-good sensor to confirm before replacing the harness',
    ],
    driverAction:
      'You can keep driving, but one reading is missing. Have it checked at the next stop.',
    vehicleCanContinue: true,
    requiresImmediateShutdown: false,
    clearing: 'self-clearing',
  },

  CAN_COMM_LOSS: {
    code: 'CAN_COMM_LOSS',
    title: 'No data from the vehicle controller',
    description:
      'The ESP32 is no longer receiving CAN messages from the STM32. Readings on screen are from before the link was lost and must not be treated as current.',
    subsystem: 'communication',
    severity: 'emergency',
    measurementId: null,
    unit: null,
    warningThreshold: null,
    criticalThreshold: null,
    normalRangeMin: null,
    normalRangeMax: null,
    possibleCauses: [
      'CAN wiring between the STM32 and the ESP32 is broken or disconnected',
      'A CAN bus termination resistor is missing or has failed',
      'The STM32 has reset, halted or lost power',
      'CAN transceiver failure on either board',
      'Severe electrical noise on the bus causing repeated errors',
    ],
    recommendedActions: [
      'Stop the vehicle safely — the displayed readings are no longer live',
      'Check that the STM32 has power and its status LED is behaving normally',
      'Inspect the CAN-H and CAN-L wiring and connectors end to end',
      'Measure resistance across CAN-H and CAN-L with power off — roughly 60 Ω means both terminators are present',
      'Check the CAN error counter on the System Status page after restoring the link',
    ],
    driverAction:
      'Stop the vehicle safely. The display is not receiving live data from the vehicle controller.',
    vehicleCanContinue: false,
    requiresImmediateShutdown: true,
    clearing: 'self-clearing',
  },

  GNSS_SIGNAL_LOSS: {
    code: 'GNSS_SIGNAL_LOSS',
    title: 'Location is unavailable',
    description:
      'The GNSS module does not have a valid signal, so the vehicle position cannot be updated. The last known position is kept and clearly labelled as old.',
    subsystem: 'location',
    severity: 'information',
    measurementId: null,
    unit: null,
    warningThreshold: null,
    criticalThreshold: null,
    normalRangeMin: null,
    normalRangeMax: null,
    possibleCauses: [
      'Vehicle is indoors, in a garage or under dense cover',
      'GNSS antenna is disconnected or damaged',
      'Antenna has been moved somewhere with no view of the sky',
      'Module is still performing its first fix after power-up',
      'Local interference on the GNSS band',
    ],
    recommendedActions: [
      'Move the vehicle where it has a clear view of the sky and wait a few minutes',
      'Check that the GNSS antenna connector is seated',
      'Inspect the antenna cable for damage or sharp bends',
      'Confirm the antenna is mounted with an unobstructed upward view',
      'Check the satellite count on the Location page once a signal returns',
    ],
    driverAction: 'No action needed for driving. Only the map is affected.',
    vehicleCanContinue: true,
    requiresImmediateShutdown: false,
    clearing: 'self-clearing',
  },

  PRECHARGE_TIMEOUT: {
    code: 'PRECHARGE_TIMEOUT',
    title: 'Pre-charge did not complete',
    description:
      'The DC link did not reach the expected voltage within the allowed pre-charge time, so the main contactor was not closed. The vehicle will not move.',
    subsystem: 'precharge',
    severity: 'emergency',
    measurementId: 'batteryVoltage',
    unit: 'V',
    warningThreshold: null,
    criticalThreshold: battery.criticalLow,
    normalRangeMin: battery.normalMin,
    normalRangeMax: battery.normalMax,
    possibleCauses: [
      'Pre-charge resistor has gone open circuit',
      'Short circuit or heavy leakage on the DC link',
      'Failed DC link capacitor',
      'Pre-charge relay is not closing',
      'Pack voltage is too low to complete pre-charge',
    ],
    recommendedActions: [
      'Do not attempt to bypass pre-charge — a direct connection can weld the main contactor',
      'With the pack isolated, measure the pre-charge resistor for continuity',
      'Check the DC link for a short across the inverter input',
      'Listen and check for the pre-charge relay operating when the system is switched on',
      'Confirm pack voltage is within its normal range before retrying',
    ],
    driverAction:
      'The vehicle cannot be driven. Contact a technician before trying again.',
    vehicleCanContinue: false,
    requiresImmediateShutdown: true,
    clearing: 'service-required',
  },
};

export const FAULT_CODES = Object.keys(FAULT_DEFINITIONS) as FaultCode[];

export function faultDefinition(code: string): FaultDefinition | undefined {
  return FAULT_DEFINITIONS[code as FaultCode];
}

/** Build a full fault record from a catalogue entry. Used by the mock service. */
export function buildFault(
  code: FaultCode,
  overrides: Partial<VehicleFault> & { detectedAt: string; lastSeenAt: string },
): VehicleFault {
  const def = FAULT_DEFINITIONS[code];
  const unit =
    def.unit ?? (def.measurementId ? MEASUREMENTS[def.measurementId].unit : null);
  const rangeText =
    def.normalRangeMin !== null && def.normalRangeMax !== null
      ? `${def.normalRangeMin} to ${def.normalRangeMax}${unit ? ` ${unit}` : ''}`
      : null;

  return {
    id: `${code}-${overrides.detectedAt}`,
    code,
    title: def.title,
    description: def.description,
    subsystem: def.subsystem,
    severity: def.severity,
    status: 'active',
    resolvedAt: null,
    measuredValue: null,
    unit,
    warningThreshold: def.warningThreshold,
    criticalThreshold: def.criticalThreshold,
    possibleCauses: def.possibleCauses,
    recommendedActions: def.recommendedActions,
    measurementId: def.measurementId,
    normalRangeText: rangeText,
    normalRangeMin: def.normalRangeMin,
    normalRangeMax: def.normalRangeMax,
    vehicleCanContinue: def.vehicleCanContinue,
    requiresImmediateShutdown: def.requiresImmediateShutdown,
    clearing: def.clearing,
    occurrenceCount: 1,
    acknowledgedAt: null,
    ...overrides,
  };
}
