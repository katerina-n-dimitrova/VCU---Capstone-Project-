/**
 * The single switch between simulated and real data.
 *
 * Change `VITE_DATA_SOURCE` (see `.env.example`) or the default in
 * `src/config/endpoints.ts`. No UI component imports a concrete service.
 */

import { APP_INFO, DATA_SOURCE_MODE, type DataSourceMode } from '../config/endpoints';
import { LiveVehicleDataService } from './LiveVehicleDataService';
import { MockVehicleDataService } from './MockVehicleDataService';
import type { VehicleDataService } from './VehicleDataService';

export function createVehicleDataService(
  mode: DataSourceMode = DATA_SOURCE_MODE,
): VehicleDataService {
  return mode === 'live'
    ? new LiveVehicleDataService(APP_INFO.version)
    : new MockVehicleDataService();
}
