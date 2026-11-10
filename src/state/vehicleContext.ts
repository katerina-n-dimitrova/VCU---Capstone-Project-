import { createContext, useContext } from 'react';
import type {
  ConnectionInfo,
  ServiceError,
  SimulationControls,
} from '../services/VehicleDataService';
import type { DataSourceMode } from '../config/endpoints';
import type {
  MeasurementSnapshot,
  SystemInfo,
  VehicleFault,
  VehicleStatus,
} from '../types/vehicle';
import type { OverallStatusResult } from '../utils/status';
import type { HistoryStore } from './history';

export interface VehicleDataContextValue {
  mode: DataSourceMode;
  simulated: boolean;
  endpoint: string;

  /** True until the first status frame has been received. */
  loading: boolean;
  connection: ConnectionInfo;
  lastError: ServiceError | null;

  status: VehicleStatus | null;
  measurements: MeasurementSnapshot | null;
  system: SystemInfo | null;
  activeFaults: VehicleFault[];
  faultHistory: VehicleFault[];
  overall: OverallStatusResult;

  /** Shared measurement history for the charts. */
  history: HistoryStore;
  /** Increments whenever history changes, so chart components re-read it. */
  historyVersion: number;

  /** A clock that ticks twice a second, used for staleness checks. */
  now: number;

  acknowledgeFault: (faultId: string) => void;
  refresh: () => void;

  /** Present only when the mock service is in use. */
  simulation: SimulationControls | undefined;
}

export const VehicleDataContext = createContext<VehicleDataContextValue | null>(null);

export function useVehicleData(): VehicleDataContextValue {
  const value = useContext(VehicleDataContext);
  if (!value) {
    throw new Error('useVehicleData must be used inside <VehicleDataProvider>');
  }
  return value;
}
