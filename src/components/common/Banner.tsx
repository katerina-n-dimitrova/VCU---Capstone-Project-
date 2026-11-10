import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'info' | 'warning' | 'critical' | 'offline' | 'demo';

const ICONS: Record<BannerTone, IconName> = {
  info: 'info',
  warning: 'alert-triangle',
  critical: 'alert-octagon',
  offline: 'wifi-off',
  demo: 'flask',
};

export function Banner({
  tone,
  children,
  action,
  role,
}: {
  tone: BannerTone;
  children: ReactNode;
  action?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={`banner banner--${tone}`} role={role}>
      <Icon name={ICONS[tone]} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {action}
    </div>
  );
}
