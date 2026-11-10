/**
 * Turns fault events into in-app notifications.
 *
 * Rules, from the project brief:
 *  - a new fault raises one visible notice, in plain language
 *  - the same unchanged fault never raises a second notice
 *  - a fault that escalates (warning to critical) does raise a new notice
 *  - emergency and critical notices stay until acknowledged
 *  - warnings can be dismissed, and remain in the fault history either way
 *  - a fault that resolves takes its notice with it
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVehicleData } from './vehicleContext';
import { faultDefinition } from '../services/faultCatalog';
import { formatWithUnit } from '../utils/format';
import type { VehicleFault } from '../types/vehicle';
import {
  NotificationContext,
  type FaultNotification,
  type NotificationContextValue,
} from './notificationContext';

function buildMessage(fault: VehicleFault): string {
  const definition = faultDefinition(fault.code);
  if (fault.measuredValue !== null) {
    const measured = formatWithUnit(fault.measuredValue, fault.unit, 1);
    const limit =
      fault.criticalThreshold !== null
        ? formatWithUnit(fault.criticalThreshold, fault.unit, 0)
        : fault.warningThreshold !== null
          ? formatWithUnit(fault.warningThreshold, fault.unit, 0)
          : null;
    const subject = definition?.title ?? fault.title;
    if (limit) {
      return `${subject}: the reading is ${measured}, past its approved limit of ${limit}.`;
    }
    return `${subject}: the reading is ${measured}.`;
  }
  return fault.description;
}

function toNotification(fault: VehicleFault): FaultNotification {
  const definition = faultDefinition(fault.code);
  const mustAcknowledge = fault.severity === 'critical' || fault.severity === 'emergency';
  return {
    key: `${fault.id}:${fault.severity}`,
    faultId: fault.id,
    code: fault.code,
    title: fault.title,
    message: buildMessage(fault),
    action: definition?.driverAction ?? fault.recommendedActions[0] ?? 'Have the vehicle checked.',
    severity: fault.severity,
    subsystem: fault.subsystem,
    detectedAt: fault.detectedAt,
    requiresAcknowledgement: mustAcknowledge,
    acknowledged: false,
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { activeFaults } = useVehicleData();
  const [notifications, setNotifications] = useState<FaultNotification[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  /** Keys already raised once, so an unchanged fault never notifies twice. */
  const raised = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeKeys = new Set(activeFaults.map((f) => `${f.id}:${f.severity}`));
    const activeIds = new Set(activeFaults.map((f) => f.id));

    const fresh = activeFaults
      .filter((fault) => !raised.current.has(`${fault.id}:${fault.severity}`))
      .map(toNotification);

    for (const notification of fresh) raised.current.add(notification.key);

    setNotifications((previous) => {
      // Drop notices whose fault has resolved, and any superseded severity.
      const kept = previous.filter(
        (n) => activeIds.has(n.faultId) && activeKeys.has(n.key),
      );
      if (fresh.length === 0 && kept.length === previous.length) return previous;
      return [...fresh, ...kept];
    });
  }, [activeFaults]);

  const dismiss = useCallback((key: string) => {
    setDismissed((previous) => ({ ...previous, [key]: true }));
  }, []);

  const acknowledge = useCallback((key: string) => {
    setNotifications((previous) =>
      previous.map((n) => (n.key === key ? { ...n, acknowledged: true } : n)),
    );
    setDismissed((previous) => ({ ...previous, [key]: true }));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed((previous) => {
      const next = { ...previous };
      for (const n of notifications) {
        if (!n.requiresAcknowledgement) next[n.key] = true;
      }
      return next;
    });
  }, [notifications]);

  const visible = useMemo(
    () => notifications.filter((n) => !dismissed[n.key]),
    [notifications, dismissed],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, visible, dismiss, acknowledge, dismissAll }),
    [notifications, visible, dismiss, acknowledge, dismissAll],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
