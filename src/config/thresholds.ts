/*
 * ============================================================================
 *  PLACEHOLDER THRESHOLDS — NOT APPROVED FOR USE ON A REAL VEHICLE
 * ============================================================================
 *
 *  Every number in this file is a PLACEHOLDER chosen so that the user interface
 *  can be developed and demonstrated. None of these values have been reviewed.
 *
 *  BEFORE THESE VALUES ARE USED FOR ANYTHING OTHER THAN UI DEVELOPMENT THEY
 *  MUST BE APPROVED BY THE ELECTRICAL TEAM AND THE PROJECT SPONSOR.
 *
 *  Note on responsibility (see README "Safety boundary"):
 *  The STM32 is the authority for fault detection and safety decisions. The
 *  thresholds below are used ONLY to
 *    (a) draw reference lines and colour bands in the user interface, and
 *    (b) drive the MOCK data service during development.
 *  The application never decides whether the vehicle is safe.
 *
 *  This is the ONLY file in the application that contains threshold numbers.
 * ============================================================================
 */

/** Displayed anywhere thresholds are shown, so nobody mistakes them for final values. */
export const THRESHOLD_APPROVAL = {
  approved: false,
  badge: 'Placeholder values',
  notice:
    'Threshold values are placeholders for development only. They require approval from the electrical team and the project sponsor before use on a vehicle.',
  lastReviewed: null as string | null,
  sourceFile: 'src/config/thresholds.ts',
} as const;

/**
 * A measurement threshold set.
 * `null` means "no limit defined in this direction" — it is NOT zero.
 */
export interface ThresholdSet {
  /** Lower edge of the expected operating band. */
  normalMin: number | null;
  /** Upper edge of the expected operating band. */
  normalMax: number | null;
  criticalLow: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalHigh: number | null;
  /** Full scale used for gauges / chart axis padding. */
  displayMin: number;
  displayMax: number;
}

/** Nominal pack configuration this UI was laid out against (placeholder). */
export const PACK_NOMINAL = {
  nominalVoltageV: 72,
  chemistryNote: 'Assumed 72 V nominal LFP pack — confirm with electrical team.',
} as const;

export const THRESHOLDS = {
  batteryVoltage: {
    normalMin: 62,
    normalMax: 86,
    criticalLow: 58,
    warningLow: 62,
    warningHigh: 86,
    criticalHigh: 88,
    displayMin: 50,
    displayMax: 92,
  },
  batteryCurrent: {
    // Positive = discharge, negative = regeneration / charging.
    normalMin: -60,
    normalMax: 120,
    criticalLow: -90,
    warningLow: -60,
    warningHigh: 150,
    criticalHigh: 180,
    displayMin: -100,
    displayMax: 200,
  },
  stateOfCharge: {
    normalMin: 20,
    normalMax: 100,
    criticalLow: 10,
    warningLow: 20,
    warningHigh: null,
    criticalHigh: null,
    displayMin: 0,
    displayMax: 100,
  },
  inputDuty: {
    normalMin: 0,
    normalMax: 100,
    criticalLow: null,
    warningLow: null,
    warningHigh: null,
    criticalHigh: null,
    displayMin: 0,
    displayMax: 100,
  },
  phaseCurrent: {
    normalMin: 0,
    normalMax: 160,
    criticalLow: null,
    warningLow: null,
    warningHigh: 180,
    criticalHigh: 220,
    displayMin: 0,
    displayMax: 240,
  },
  inverterTemperature: {
    normalMin: -10,
    normalMax: 70,
    criticalLow: null,
    warningLow: null,
    warningHigh: 80,
    criticalHigh: 95,
    displayMin: 0,
    displayMax: 110,
  },
  mcuTemperature: {
    normalMin: -10,
    normalMax: 60,
    criticalLow: null,
    warningLow: null,
    warningHigh: 75,
    criticalHigh: 85,
    displayMin: 0,
    displayMax: 100,
  },
} as const satisfies Record<string, ThresholdSet>;

/** Placeholder limits that are not a single measurement band. */
export const SYSTEM_LIMITS = {
  /** Phase-current imbalance, as a percentage of the mean phase current. */
  phaseImbalanceWarningPercent: 15,
  phaseImbalanceCriticalPercent: 25,
  /** Pre-charge must complete within this time. */
  prechargeTimeoutMs: 2000,
  /** A CAN frame older than this marks the bus as not receiving. */
  canMessageStaleMs: 1500,
  canCommunicationLostMs: 3000,
  /** A GNSS fix older than this is shown as "last known", never as "current". */
  gnssFixStaleMs: 15000,
  gnssAccuracyWarningMeters: 25,
  /** Default per-measurement staleness timeout when the catalogue does not override it. */
  defaultMeasurementStaleMs: 2000,
} as const;
