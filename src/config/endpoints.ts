/**
 * ============================================================================
 *  THE ONLY PLACE ENDPOINTS AND CONNECTION SETTINGS ARE DEFINED
 * ============================================================================
 *
 * When the ESP32 firmware changes an address, change it here and nowhere else.
 *
 * Every value can be overridden at build time with a Vite environment variable
 * (see `.env.example`), so the same source tree can be built for a laptop dev
 * server or for the ESP32 without editing code.
 */

export type DataSourceMode = 'mock' | 'live';

const env = import.meta.env;

function envString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function envNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 'mock'  — everything comes from MockVehicleDataService (no hardware needed)
 * 'live'  — everything comes from the ESP32 over REST + WebSocket
 *
 * Default is 'mock' during development and 'live' for a production build,
 * because a production build is the one that gets flashed to the ESP32.
 */
export const DATA_SOURCE_MODE: DataSourceMode =
  envString(env.VITE_DATA_SOURCE, env.PROD ? 'live' : 'mock') === 'live' ? 'live' : 'mock';

/** Show the demo/simulation controls. Off by default in a production build. */
export const SIMULATION_CONTROLS_ENABLED: boolean =
  envString(env.VITE_SIMULATION_CONTROLS, env.PROD ? 'false' : 'true') !== 'false';

/**
 * Base URL of the ESP32 HTTP server.
 * Empty string means "same origin as this page", which is what happens once
 * the built files are served by the ESP32 itself.
 */
export const API_BASE_URL: string = envString(env.VITE_API_BASE_URL, '');

/** Default address used when the app is opened from a laptop dev server. */
export const DEFAULT_DEVICE_ADDRESS = '192.168.4.1';

export const API_ROUTES = {
  status: '/api/v1/status',
  faults: '/api/v1/faults',
  faultHistory: '/api/v1/faults/history',
  measurements: '/api/v1/measurements',
  system: '/api/v1/system',
  location: '/api/v1/location',
} as const;

export const WS_ROUTE = '/api/v1/stream';

export const CONNECTION = {
  /** REST timeout for the initial load. */
  requestTimeoutMs: envNumber(env.VITE_REQUEST_TIMEOUT_MS, 6000),
  /** WebSocket reconnect backoff. */
  reconnectInitialDelayMs: 1000,
  reconnectMaxDelayMs: 15000,
  reconnectFactor: 1.8,
  /** If no WebSocket frame arrives in this window, the link is shown as lost. */
  socketSilenceTimeoutMs: envNumber(env.VITE_SOCKET_SILENCE_MS, 5000),
  /** How often the app re-polls REST endpoints that are not pushed over WS. */
  restPollIntervalMs: envNumber(env.VITE_REST_POLL_MS, 15000),
} as const;

/** Resolve an API route against the configured base URL. */
export function apiUrl(route: string): string {
  if (!API_BASE_URL) return route;
  return `${API_BASE_URL.replace(/\/$/, '')}${route}`;
}

/** Resolve the WebSocket URL, following the page protocol when same-origin. */
export function streamUrl(): string {
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}${WS_ROUTE}`;
  }
  if (typeof window === 'undefined') return `ws://${DEFAULT_DEVICE_ADDRESS}${WS_ROUTE}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${WS_ROUTE}`;
}

/** Map tiles are only reachable when the device running the browser has internet. */
export const MAP_TILES = {
  urlTemplate: envString(
    env.VITE_MAP_TILE_URL,
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  ),
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
  /** If no tile loads within this window, fall back to the offline location card. */
  probeTimeoutMs: 4000,
} as const;

export const APP_INFO = {
  name: 'Tuk-Tuk Vehicle Monitor',
  shortName: 'VCU Monitor',
  version: envString(env.VITE_APP_VERSION, '0.1.0-dev'),
  /** Kenya. Used only to centre the map before a first fix, never shown as a position. */
  fallbackMapCentre: { latitude: -1.2921, longitude: 36.8219 },
} as const;
