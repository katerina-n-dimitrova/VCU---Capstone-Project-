import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';
import type { ChartCard as ChartCardType } from './ChartCard';

const ChartCardImpl = lazy(() =>
  import('./ChartCard').then((m) => ({ default: m.ChartCard })),
);

/**
 * Loads the charting library only when a chart is actually shown, which keeps
 * it out of the first download on a page that usually has no chart on it.
 */
export function LazyChartCard(props: ComponentProps<typeof ChartCardType>) {
  return (
    <Suspense
      fallback={
        <div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading chart" />
      }
    >
      <ChartCardImpl {...props} />
    </Suspense>
  );
}
