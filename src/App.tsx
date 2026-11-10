import { Suspense, lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { VehicleDataProvider } from './state/VehicleDataProvider';
import { NotificationProvider } from './state/NotificationProvider';
import { AppShell } from './components/layout/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { FaultsPage } from './pages/FaultsPage';
import { LiveDataPage } from './pages/LiveDataPage';
import { SystemStatusPage } from './pages/SystemStatusPage';
import { StateBlock } from './components/common/StateBlock';

/*
 * The two heaviest pages are split out so the first screen stays small. That
 * matters here: the built files are served from the ESP32's own flash over a
 * local hotspot, so every kilobyte is paid for on first load.
 */
const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })),
);
const LocationPage = lazy(() =>
  import('./pages/LocationPage').then((m) => ({ default: m.LocationPage })),
);

/*
 * HashRouter rather than BrowserRouter: the ESP32 serves static files and has
 * no URL-rewriting, so a page reload on /analysis would 404 with real paths.
 */
export function App() {
  return (
    <VehicleDataProvider>
      <NotificationProvider>
        <HashRouter>
          <AppShell>
            <Suspense fallback={<StateBlock title="Loading this page…" busy />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/faults" element={<FaultsPage />} />
                <Route path="/live" element={<LiveDataPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/location" element={<LocationPage />} />
                <Route path="/system" element={<SystemStatusPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppShell>
        </HashRouter>
      </NotificationProvider>
    </VehicleDataProvider>
  );
}

function NotFound() {
  return (
    <div className="page">
      <StateBlock icon="search" title="That page does not exist">
        <p>Use the navigation to get back to the vehicle overview.</p>
      </StateBlock>
    </div>
  );
}
