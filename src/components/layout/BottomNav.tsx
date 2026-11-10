import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import { Icon } from '../common/Icon';
import { pluralise } from '../../utils/format';

/**
 * Compact bottom bar for phones. Every destination keeps a text label under its
 * icon, and each target is at least 44 px tall.
 */
export function BottomNav({ faultCount }: { faultCount: number }) {
  return (
    <nav className="bottom-nav" aria-label="Sections">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className="bottom-nav__item"
        >
          <Icon name={item.icon} size={20} />
          <span>{item.shortLabel}</span>
          {item.to === '/faults' && faultCount > 0 ? (
            <span className="bottom-nav__badge">
              <span aria-hidden="true">{faultCount}</span>
              <span className="sr-only">
                {faultCount} active {pluralise(faultCount, 'fault')}
              </span>
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
