import { createContext, useContext } from 'react';
import type { Severity, Subsystem } from '../types/vehicle';

export interface FaultNotification {
  /** `${faultId}:${severity}` — a fault that escalates produces a new notice. */
  key: string;
  faultId: string;
  code: string;
  title: string;
  /** Plain-language sentence describing what happened. */
  message: string;
  /** What the person reading this should do now. */
  action: string;
  severity: Severity;
  subsystem: Subsystem;
  detectedAt: string;
  /** Emergency and critical notices stay until someone acknowledges them. */
  requiresAcknowledgement: boolean;
  acknowledged: boolean;
}

export interface NotificationContextValue {
  notifications: FaultNotification[];
  /** Notices still on screen, newest first. */
  visible: FaultNotification[];
  dismiss: (key: string) => void;
  acknowledge: (key: string) => void;
  dismissAll: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error('useNotifications must be used inside <NotificationProvider>');
  }
  return value;
}
