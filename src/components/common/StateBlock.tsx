import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * The shared empty / loading / offline / error block, so every one of those
 * states looks the same and always explains itself rather than showing a blank
 * area.
 */
export function StateBlock({
  icon,
  title,
  children,
  action,
  busy = false,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="state-block" role={busy ? 'status' : undefined} aria-live={busy ? 'polite' : undefined}>
      {busy ? <div className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={26} /> : null}
      <p className="state-block__title">{title}</p>
      {children ? <div className="state-block__body">{children}</div> : null}
      {action}
    </div>
  );
}

export function LoadingBlock({ what }: { what: string }) {
  return (
    <StateBlock title={`Loading ${what}…`} busy>
      <p>Waiting for the first data from the vehicle.</p>
    </StateBlock>
  );
}
