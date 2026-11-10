import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useVehicleData } from '../../state/vehicleContext';
import { APP_INFO } from '../../config/endpoints';
import { Icon } from '../common/Icon';
import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';
import { ThemeToggle } from './ThemeToggle';
import { ConnectionIndicator } from './ConnectionIndicator';
import { NotificationCenter } from '../notifications/NotificationCenter';

export function AppShell({ children }: { children: ReactNode }) {
  const { activeFaults, status } = useVehicleData();
  const unresolved = activeFaults.filter((fault) => fault.status !== 'resolved');

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <Link to="/" className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
            <Icon name="gauge" size={20} />
          </span>
          <span className="app-header__titles">
            <span className="app-header__title">{APP_INFO.name}</span>
            <span className="app-header__subtitle">
              {status?.vehicleId ?? 'No vehicle connected'}
            </span>
          </span>
          <span className="sr-only">Go to the vehicle overview</span>
        </Link>

        <span className="app-header__spacer" />

        <div className="app-header__actions">
          <ConnectionIndicator />
          <ThemeToggle />
        </div>
      </header>

      <div className="app-body">
        <SideNav faultCount={unresolved.length} />
        <main className="app-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <BottomNav faultCount={unresolved.length} />
      <NotificationCenter />
    </div>
  );
}
