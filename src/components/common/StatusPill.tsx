import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type PillTone =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'emergency'
  | 'information'
  | 'offline'
  | 'unavailable'
  | 'demo';

const DEFAULT_ICON: Record<PillTone, IconName> = {
  normal: 'check-circle',
  warning: 'alert-triangle',
  critical: 'alert-triangle',
  emergency: 'alert-octagon',
  information: 'info',
  offline: 'wifi-off',
  unavailable: 'close',
  demo: 'flask',
};

/**
 * A short status label. The word is always present — the colour and the icon
 * only reinforce it.
 */
export function StatusPill({
  tone,
  children,
  icon,
  large = false,
  title,
}: {
  tone: PillTone;
  children: ReactNode;
  icon?: IconName | null;
  large?: boolean;
  title?: string;
}) {
  const name = icon === null ? null : (icon ?? DEFAULT_ICON[tone]);
  return (
    <span className={`pill pill--${tone}${large ? ' pill--lg' : ''}`} title={title}>
      {name ? <Icon name={name} size={large ? 16 : 14} /> : null}
      {children}
    </span>
  );
}
