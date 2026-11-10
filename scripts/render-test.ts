/**
 * Renders the real application in jsdom and drives it the way a person would.
 *
 * Run with: npm run render-test
 *
 * This is the check that the pages actually mount, that the provider wiring
 * works, that a simulated fault produces a notification, and that missing
 * values reach the screen as "—" rather than as a number.
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const anyGlobal = globalThis as unknown as Record<string, unknown>;
anyGlobal.window = dom.window;
anyGlobal.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
anyGlobal.HTMLElement = dom.window.HTMLElement;
anyGlobal.SVGElement = dom.window.SVGElement;
anyGlobal.Element = dom.window.Element;
anyGlobal.Node = dom.window.Node;
anyGlobal.getComputedStyle = dom.window.getComputedStyle;
anyGlobal.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 16) as unknown as number;
anyGlobal.cancelAnimationFrame = (id: number) => clearTimeout(id);
anyGlobal.IS_REACT_ACT_ENVIRONMENT = false;
// jsdom has no layout engine, so scrollIntoView is not implemented.
dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};

const { createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { App } = await import('../src/App');

const failures: string[] = [];
const passes: string[] = [];

function check(condition: boolean, message: string) {
  if (condition) passes.push(`  ok    ${message}`);
  else failures.push(`  FAIL  ${message}`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const text = () => dom.window.document.body.textContent ?? '';
const $ = (selector: string) => dom.window.document.querySelector(selector);
const $$ = (selector: string) => [...dom.window.document.querySelectorAll(selector)];

function clickByText(selector: string, needle: string): boolean {
  const element = $$(selector).find((node) =>
    (node.textContent ?? '').toLowerCase().includes(needle.toLowerCase()),
  );
  if (!element) return false;
  (element as HTMLElement).click();
  return true;
}

async function navigate(hash: string) {
  dom.window.location.hash = hash;
  await wait(400);
}

async function main() {
  const root = createRoot(dom.window.document.getElementById('root')!);
  root.render(createElement(App));
  await wait(1500);

  /* ---------------- Overview ---------------- */
  check(text().includes('Vehicle overview'), 'overview page renders');
  check(text().includes('Operating normally'), 'overall status headline shows');
  check(text().includes('Simulated data'), 'the simulated-data banner is shown in mock mode');
  check(text().includes('Battery voltage'), 'battery voltage tile renders');
  check(text().includes('Estimated charge left'), 'state of charge tile renders');
  check(text().includes('Motor phase A current'), 'phase current tiles render');
  check($$('.metric').length >= 9, `all nine measurement tiles render (${$$('.metric').length})`);
  check(text().includes('Skip to main content'), 'skip link is present');
  check($('.app-header') !== null, 'header renders');
  check($$('.bottom-nav__item').length === 6, 'bottom navigation has six destinations');
  check($$('.side-nav__item').length === 6, 'side navigation has six destinations');

  // Units must sit beside every value.
  const firstTile = $('.metric');
  check(
    (firstTile?.textContent ?? '').includes('%') || (firstTile?.textContent ?? '').includes('V'),
    'a unit is shown beside the value',
  );

  check(
    text().includes('Technical summary of this frame'),
    'technical detail is available behind an expander on the main screen',
  );
  check(clickByText('.disclosure__summary', 'Technical summary'), 'the expander opens');
  await wait(200);
  check(text().includes('Sequence number'), 'the expanded technical summary shows frame detail');

  /* ---------------- Accessibility basics ---------------- */
  check($$('h1').length === 1, 'exactly one h1 per page');
  check($('main#main-content') !== null, 'main landmark is present and targetable');
  check($$('nav[aria-label]').length >= 2, 'navigation landmarks are labelled');
  check($$('.sr-only').length > 0, 'screen-reader-only labels are used');

  /* ---------------- Live data ---------------- */
  await navigate('#/live');
  check(text().includes('Live data'), 'live data page renders');
  check($$('.data-table tbody tr').length === 9, 'live table has one row per measurement');
  check(text().includes('Normal range'), 'the normal range column is present');
  check(clickByText('button', 'Technical view'), 'technical view toggle exists');
  await wait(300);
  check(text().includes('CAN ID'), 'technical view adds signal and CAN columns');
  check(text().includes('0x120'), 'CAN identifiers are shown');
  clickByText('button', 'Simple view');
  await wait(200);

  /* ---------------- Faults page (no faults yet) ---------------- */
  await navigate('#/faults');
  check(text().includes('Active faults'), 'faults page renders');
  check(text().includes('No faults reported'), 'empty state explains itself');
  check($('#fault-search') !== null, 'fault search field is present');
  check($('#filter-severity') !== null, 'severity filter is present');
  check($('#filter-subsystem') !== null, 'subsystem filter is present');
  check($('#filter-status') !== null, 'status filter is present');

  /* ---------------- System status ---------------- */
  await navigate('#/system');
  check(text().includes('System and connection status'), 'system page renders');
  check(text().includes('STM32'), 'STM32 status is shown');
  check(text().includes('Wi-Fi hotspot'), 'hotspot status is shown');
  check(
    text().includes('does not decide whether the vehicle is safe'),
    'the safety boundary is stated in the app itself',
  );

  /* ---------------- Analysis (lazy chunk) ---------------- */
  await navigate('#/analysis');
  await wait(900);
  check(text().includes('Data analysis'), 'analysis page loads from its lazy chunk');
  check(text().includes('Last 5 minutes'), 'time-window controls render');
  check(text().includes('Current session'), 'session window control renders');
  check(text().includes('Maximum'), 'per-chart statistics render');
  check($$('.chart-card').length >= 9, `charts render (${$$('.chart-card').length})`);

  /* ---------------- Location (lazy chunk) ---------------- */
  await navigate('#/location');
  await wait(900);
  check(text().includes('Vehicle location'), 'location page loads from its lazy chunk');
  check(text().includes('Copy coordinates'), 'copy-coordinates control is present');
  check(text().includes('Latitude'), 'latitude is listed');

  /* ---------------- Drive a critical fault through the UI ---------------- */
  await navigate('#/system');
  const opened = clickByText('.demo-panel__summary', 'Demo controls');
  await wait(300);
  check(opened, 'demo controls panel is reachable and clearly labelled');
  const started = clickByText('.scenario-button', 'Inverter overheating');
  check(started, 'the inverter overheating scenario can be started');
  await wait(20000);

  check(text().includes('Critical'), 'a critical notification appears');
  check(
    text().includes('Inverter temperature is too high'),
    'the notification names the fault in plain language',
  );
  check(text().includes('INV_OVER_TEMP'), 'the notification shows the fault code');
  check(
    text().includes('Stop the vehicle safely'),
    'the notification says what the user should do',
  );
  check($('.notification .btn--primary') !== null, 'a critical notification must be acknowledged');

  await navigate('#/faults');
  check(text().includes('Inverter temperature is too high'), 'the fault is listed on the faults page');
  check(clickByText('button', 'Show technical details'), 'technical details can be expanded');
  await wait(300);
  check(text().includes('Possible causes'), 'possible causes are listed');
  check(text().includes('Recommended inspection steps'), 'inspection steps are listed');
  check(text().includes('Requires immediate shutdown'), 'operating restrictions are shown');
  check(
    text().includes('requires authorised diagnostic support'),
    'fault clearing is marked as needing authorised support',
  );
  const clearButton = $$('button').find((b) =>
    (b.textContent ?? '').includes('Clear fault'),
  ) as HTMLButtonElement | undefined;
  check(clearButton?.disabled === true, 'the clear-fault control is disabled in the app');

  /* ---------------- Sensor disconnection: null, not zero ---------------- */
  await navigate('#/system');
  clickByText('.demo-panel__summary', 'Demo controls');
  await wait(200);
  clickByText('.scenario-button', 'Sensor disconnection');
  await wait(4000);
  await navigate('#/live');
  const currentRow = $$('.data-table tbody tr').find((row) =>
    (row.textContent ?? '').includes('Battery current'),
  );
  const rowText = currentRow?.textContent ?? '';
  check(rowText.includes('—'), 'a disconnected sensor shows an em dash');
  check(!/\b0\.0\b/.test(rowText.split('expected')[0]), 'a disconnected sensor is not shown as 0.0');
  check(rowText.includes('Unavailable'), 'the row is labelled Unavailable');

  /* ---------------- CAN loss ---------------- */
  await navigate('#/system');
  clickByText('.demo-panel__summary', 'Demo controls');
  await wait(200);
  clickByText('.scenario-button', 'CAN communication loss');
  await wait(6000);
  check(
    text().includes('not receiving data from the STM32'),
    'CAN loss is explained in plain language',
  );
  await navigate('#/');
  check(
    text().includes('No data from the vehicle controller'),
    'the overview headline changes when CAN is lost',
  );

  /* ---------------- GNSS loss ---------------- */
  await navigate('#/system');
  clickByText('.demo-panel__summary', 'Demo controls');
  await wait(200);
  clickByText('.scenario-button', 'GNSS signal loss');
  await wait(4000);
  await navigate('#/location');
  await wait(600);
  check(
    text().includes('last known position') || text().includes('Last known position'),
    'an old position is labelled as last known, not current',
  );
  check(
    text().includes('does not have a valid signal'),
    'the reason for the missing position is explained',
  );

  root.unmount();

  console.log(passes.join('\n'));
  if (failures.length > 0) console.log(failures.join('\n'));
  console.log(`\n${passes.length} passed, ${failures.length} failed`);
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
