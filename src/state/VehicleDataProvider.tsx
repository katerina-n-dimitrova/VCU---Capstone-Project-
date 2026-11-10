/**
 * Owns the data service, the measurement history and everything derived from
 * them. Every page reads from here through `useVehicleData()`; no page ever
 * touches a service directly.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createVehicleDataService } from '../services/createVehicleDataService';
import type {
  ConnectionInfo,
  ServiceError,
  VehicleDataService,
} from '../services/VehicleDataService';
import { MEASUREMENT_IDS } from '../config/measurements';
import type {
  MeasurementSnapshot,
  SystemInfo,
  VehicleFault,
  VehicleStatus,
} from '../types/vehicle';
import { deriveOverallStatus } from '../utils/status';
import { nowIso } from '../utils/time';
import { HistoryStore } from './history';
import { VehicleDataContext, type VehicleDataContextValue } from './vehicleContext';

const CLOCK_INTERVAL_MS = 500;

export function VehicleDataProvider({ children }: { children: ReactNode }) {
  // Created once and kept for the life of the provider. A lazy useState
  // initialiser is the stable way to do this — a new service on every render
  // would open a new connection each time.
  const [service] = useState<VehicleDataService>(() => createVehicleDataService());
  const [history] = useState<HistoryStore>(() => {
    const store = new HistoryStore();
    for (const id of MEASUREMENT_IDS) store.seed(id, service.seedHistory(id));
    return store;
  });

  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementSnapshot | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [faultHistory, setFaultHistory] = useState<VehicleFault[]>([]);
  const [lastError, setLastError] = useState<ServiceError | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [connection, setConnection] = useState<ConnectionInfo>({
    state: 'idle',
    since: nowIso(),
    lastMessageAt: null,
    attempt: 0,
    endpoint: service.endpoint,
    detail: 'Starting up…',
  });

  /* ---------------- service lifecycle ---------------- */

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = service.subscribe((event) => {
      if (cancelled) return;
      switch (event.type) {
        case 'status': {
          setStatus(event.status);
          setMeasurements(event.measurements);
          history.record(event.measurements, Date.parse(event.status.timestamp) || Date.now());
          setHistoryVersion(history.version);
          break;
        }
        case 'measurements': {
          setMeasurements(event.measurements);
          history.record(event.measurements, Date.parse(event.timestamp) || Date.now());
          setHistoryVersion(history.version);
          break;
        }
        case 'system':
          setSystem(event.system);
          break;
        case 'connection':
          setConnection(event.connection);
          break;
        case 'fault:new': {
          history.addMarker({
            t: Date.parse(event.fault.detectedAt) || Date.now(),
            code: event.fault.code,
            severity: event.fault.severity,
            title: event.fault.title,
            faultId: event.fault.id,
            measurementId: event.fault.measurementId,
          });
          setHistoryVersion(history.version);
          break;
        }
        case 'fault:resolved': {
          setFaultHistory((previous) => {
            if (previous.some((f) => f.id === event.fault.id)) return previous;
            return [event.fault, ...previous].slice(0, 100);
          });
          break;
        }
        case 'fault:updated':
          break;
        case 'error':
          setLastError(event.error);
          break;
      }
    });

    void service.start();
    void service
      .fetchFaultHistory()
      .then((list) => {
        if (!cancelled) setFaultHistory((previous) => (previous.length > 0 ? previous : list));
      })
      .catch(() => {
        /* already reported through the error event */
      });

    return () => {
      cancelled = true;
      unsubscribe();
      service.stop();
    };
  }, [service, history]);

  /* ---------------- ticking clock for staleness ---------------- */

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  /* ---------------- actions ---------------- */

  const acknowledgeFault = useCallback((faultId: string) => {
    setAcknowledged((previous) =>
      previous[faultId] ? previous : { ...previous, [faultId]: nowIso() },
    );
  }, []);

  const refresh = useCallback(() => {
    void Promise.allSettled([
      service.fetchStatus().then(setStatus),
      service.fetchMeasurements().then(setMeasurements),
      service.fetchSystemInfo().then(setSystem),
      service.fetchFaultHistory().then(setFaultHistory),
    ]);
  }, [service]);

  /* ---------------- derived ---------------- */

  const activeFaults = useMemo<VehicleFault[]>(() => {
    const list = status?.activeFaults ?? [];
    return list.map((fault) => {
      const at = acknowledged[fault.id];
      if (!at || fault.status !== 'active') return fault;
      return { ...fault, status: 'acknowledged', acknowledgedAt: at };
    });
  }, [status, acknowledged]);

  const statusWithAcks = useMemo<VehicleStatus | null>(
    () => (status ? { ...status, activeFaults } : null),
    [status, activeFaults],
  );

  const linkOpen = connection.state === 'open';
  const overall = useMemo(
    () => deriveOverallStatus(statusWithAcks, linkOpen),
    [statusWithAcks, linkOpen],
  );

  const value = useMemo<VehicleDataContextValue>(
    () => ({
      mode: service.mode,
      simulated: service.simulated,
      endpoint: service.endpoint,
      loading: status === null,
      connection,
      lastError,
      status: statusWithAcks,
      measurements,
      system,
      activeFaults,
      faultHistory,
      overall,
      history,
      historyVersion,
      now,
      acknowledgeFault,
      refresh,
      simulation: service.simulation,
    }),
    [
      service,
      status,
      connection,
      lastError,
      statusWithAcks,
      measurements,
      system,
      activeFaults,
      faultHistory,
      overall,
      history,
      historyVersion,
      now,
      acknowledgeFault,
      refresh,
    ],
  );

  return <VehicleDataContext.Provider value={value}>{children}</VehicleDataContext.Provider>;
}
