import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import { Icon } from '../common/Icon';
import { pluralise } from '../../utils/format';

export function SideNav({ faultCount }: { faultCount: number }) {
  return (
    <nav className="app-nav" aria-label="Sections">
      <p className="side-nav__label" id="side-nav-label">
        Sections
      </p>
      <div className="side-nav" role="list" aria-labelledby="side-nav-label">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="side-nav__item" role="listitem">
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            {item.to === '/faults' ? (
              <span
                className={`side-nav__item-count${faultCount === 0 ? ' side-nav__item-count--none' : ''}`}
              >
                <span aria-hidden="true">{faultCount}</span>
                <span className="sr-only">
                  {faultCount} active {pluralise(faultCount, 'fault')}
                </span>
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
