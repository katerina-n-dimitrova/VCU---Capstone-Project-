/**
 * A severity is always drawn as shape + colour + word.
 *
 * Each severity gets a different outline (circle, triangle, octagon) so the
 * four levels are distinguishable in greyscale, in print, and to anyone who
 * cannot separate the colours.
 */

import { Icon, type IconName } from './Icon';
import type { Severity } from '../../types/vehicle';

const ICONS: Record<Severity, IconName> = {
  information: 'info',
  warning: 'alert-triangle',
  critical: 'alert-triangle',
  emergency: 'alert-octagon',
};

export function SeverityIcon({
  severity,
  size = 16,
}: {
  severity: Severity;
  size?: number;
}) {
  return (
    <Icon
      name={ICONS[severity]}
      size={size}
      strokeWidth={severity === 'critical' || severity === 'emergency' ? 2.3 : 1.9}
      className="severity-icon"
    />
  );
}
