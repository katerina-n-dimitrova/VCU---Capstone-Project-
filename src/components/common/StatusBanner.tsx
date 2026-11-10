import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { OverallStatus } from '../../types/vehicle';

const ICONS: Record<OverallStatus, IconName> = {
  normal: 'check-circle',
  warning: 'alert-triangle',
  critical: 'alert-octagon',
  offline: 'wifi-off',
};

const WORD: Record<OverallStatus, string> = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
  offline: 'Offline',
};

/**
 * The headline on the overview. The status word is written out, the icon shape
 * differs per status, and the colour is the third signal rather than the only
 * one.
 */
export function StatusBanner({
  status,
  headline,
  detail,
  children,
}: {
  status: OverallStatus;
  headline: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`status-banner status-banner--${status}`}
      aria-labelledby="vehicle-status-headline"
      role="status"
    >
      <span className="status-banner__icon" aria-hidden="true">
        <Icon name={ICONS[status]} size={28} strokeWidth={2.1} />
      </span>
      <div className="status-banner__content">
        <p className="status-banner__headline" id="vehicle-status-headline">
          <span className="sr-only">Vehicle status: {WORD[status]}. </span>
          {headline}
        </p>
        <p className="status-banner__detail">{detail}</p>
        {children}
      </div>
    </section>
  );
}
