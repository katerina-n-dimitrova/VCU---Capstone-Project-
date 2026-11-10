import { THRESHOLD_APPROVAL } from '../../config/thresholds';
import { Icon } from './Icon';

/**
 * Shown next to anything drawn from the placeholder threshold file, so nobody
 * mistakes a development number for an approved limit.
 */
export function ThresholdNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="threshold-note">
        <Icon name="info" size={13} />
        {THRESHOLD_APPROVAL.badge} — not yet approved
      </p>
    );
  }
  return (
    <p className="threshold-note">
      <Icon name="info" size={14} />
      {THRESHOLD_APPROVAL.notice}
    </p>
  );
}
