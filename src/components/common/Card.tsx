import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  action,
  children,
  footer,
  accent,
  titleId,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  accent?: 'normal' | 'warning' | 'critical' | 'emergency' | 'offline';
  titleId?: string;
}) {
  return (
    <section
      className={`card${accent ? ` card--accent-${accent}` : ''}`}
      aria-labelledby={titleId}
    >
      {title ? (
        <header className="card__header">
          <div>
            <h2 className="card__title" id={titleId}>
              {title}
            </h2>
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className="card__body">{children}</div>
      {footer ? <footer className="card__footer">{footer}</footer> : null}
    </section>
  );
}
