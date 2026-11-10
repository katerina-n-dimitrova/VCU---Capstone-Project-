import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Expandable technical detail. Built on <details> so it works with the
 * keyboard and with screen readers without any JavaScript of its own.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">
        <Icon name="chevron-right" size={16} className="disclosure__chevron" />
        {summary}
      </summary>
      <div className="disclosure__content">{children}</div>
    </details>
  );
}
