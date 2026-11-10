import { Link } from 'react-router-dom';
import { useNotifications } from '../../state/notificationContext';
import { SeverityIcon } from '../common/SeverityIcon';
import { Icon } from '../common/Icon';
import { SEVERITY_LABEL, SUBSYSTEM_LABEL } from '../../utils/status';
import { formatClock } from '../../utils/time';

/**
 * In-app fault notifications.
 *
 * Emergency and critical notices have to be acknowledged before they go away.
 * Warnings and information can be dismissed, and stay in the fault history
 * either way. Nothing here ever clears a fault on the vehicle.
 */
export function NotificationCenter() {
  const { visible, dismiss, acknowledge } = useNotifications();

  if (visible.length === 0) return null;

  return (
    <div className="notification-region">
      {visible.slice(0, 4).map((notification) => {
        const urgent =
          notification.severity === 'critical' || notification.severity === 'emergency';
        return (
          <article
            key={notification.key}
            className={`notification notification--${notification.severity}`}
            role={urgent ? 'alert' : 'status'}
            aria-live={urgent ? 'assertive' : 'polite'}
          >
            <header className="notification__head">
              <SeverityIcon severity={notification.severity} size={20} />
              <h2 className="notification__title">
                {SEVERITY_LABEL[notification.severity]}: {notification.title}
              </h2>
              {!notification.requiresAcknowledgement ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon"
                  onClick={() => dismiss(notification.key)}
                >
                  <Icon name="close" size={16} />
                  <span className="sr-only">Dismiss this message</span>
                </button>
              ) : null}
            </header>

            <p className="notification__message">{notification.message}</p>

            <p className="notification__action">
              <strong>What to do: </strong>
              {notification.action}
            </p>

            <p className="notification__meta">
              <span>
                Fault code <span className="mono">{notification.code}</span>
              </span>
              <span>{SUBSYSTEM_LABEL[notification.subsystem]}</span>
              <span>Detected {formatClock(notification.detectedAt)}</span>
            </p>

            <div className="notification__buttons">
              <Link
                className="btn btn--sm"
                to={`/faults?fault=${encodeURIComponent(notification.faultId)}`}
              >
                <Icon name="external" size={15} />
                Open the full record
              </Link>
              {notification.requiresAcknowledgement ? (
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => acknowledge(notification.key)}
                >
                  <Icon name="check-circle" size={15} />
                  Acknowledge
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
