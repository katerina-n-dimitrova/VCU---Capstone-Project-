/**
 * Inline icon set.
 *
 * Icons are decorative: every one is `aria-hidden` and always sits beside a
 * real text label, so nothing in the interface is communicated by an icon or a
 * colour on its own. Drawn inline rather than loaded from a font or sprite so
 * the app has no external requests when the ESP32 serves it.
 */

export type IconName =
  | 'gauge'
  | 'alert-triangle'
  | 'alert-octagon'
  | 'activity'
  | 'chart'
  | 'map-pin'
  | 'server'
  | 'check-circle'
  | 'info'
  | 'close'
  | 'copy'
  | 'refresh'
  | 'chevron-right'
  | 'chevron-down'
  | 'search'
  | 'clock'
  | 'wifi'
  | 'wifi-off'
  | 'sun'
  | 'moon'
  | 'flask'
  | 'battery'
  | 'thermometer'
  | 'shield'
  | 'external'
  | 'pause'
  | 'play'
  | 'filter';

const PATHS: Record<IconName, string> = {
  gauge: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0 5-5M3.5 19a9 9 0 1 1 17 0',
  'alert-triangle': 'M12 3.8 2.6 19.2h18.8L12 3.8Zm0 5.4v4.6m0 2.9v.1',
  'alert-octagon': 'M8.2 2.8h7.6L21.2 8.2v7.6l-5.4 5.4H8.2l-5.4-5.4V8.2l5.4-5.4Zm3.8 4.9v5m0 2.9v.1',
  activity: 'M2.5 12h4l2.5-7 4.5 14 2.5-7h5.5',
  chart: 'M3.5 3.5v17h17M7.5 16V11m4.5 5V7m4.5 9v-3.5',
  'map-pin': 'M12 21.5s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Zm0-8.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  server:
    'M3.5 4.5h17v5h-17v-5Zm0 10h17v5h-17v-5ZM7 7h.01M7 17h.01',
  'check-circle': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-13.2.4 3 3 5.4-6',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-4.2v.1m0 3.1v5',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9.5A2.5 2.5 0 0 1 11.5 7h7A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 9 16.5v-7Zm-4 7.5A2 2 0 0 1 3 15V5.5A2.5 2.5 0 0 1 5.5 3H15a2 2 0 0 1 2 2',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  'chevron-right': 'm9.5 5.5 6.5 6.5-6.5 6.5',
  'chevron-down': 'm5.5 9.5 6.5 6.5 6.5-6.5',
  search: 'M17 17 21 21m-2.5-9.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5.2l3.2 2',
  wifi: 'M2.5 9.2a14 14 0 0 1 19 0M6 12.8a9 9 0 0 1 12 0M9.4 16.4a4 4 0 0 1 5.2 0M12 20h.01',
  'wifi-off': 'M2.5 9.2a14 14 0 0 1 5.3-3.2M15 6.5a14 14 0 0 1 6.5 2.7M6 12.8a9 9 0 0 1 3-2M18 12.8a9 9 0 0 0-2.3-1.5M9.4 16.4a4 4 0 0 1 5.2 0M12 20h.01M3 3l18 18',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-13v2m0 13v2M3.5 12h2m13 0h2M5.9 5.9l1.5 1.5m9.2 9.2 1.5 1.5m0-12.2-1.5 1.5M7.4 16.6l-1.5 1.5',
  moon: 'M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8Z',
  flask: 'M9.5 3h5M10.5 3v6.2L4.8 18.4A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 1.7-3.1L13.5 9.2V3M7.4 15h9.2',
  battery: 'M3.5 8.5h13v7h-13v-7Zm13 2h2.5v3h-2.5m-10-3v3',
  thermometer: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z',
  shield: 'M12 21.5s7.5-3.4 7.5-9.5V5.5L12 2.5 4.5 5.5V12c0 6.1 7.5 9.5 7.5 9.5Z',
  external: 'M14 4h6v6M20 4l-8.5 8.5M18 14.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 4.5 19 12 7 19.5v-15Z',
  filter: 'M3.5 5.5h17l-6.5 7.5v6l-4 2.5v-8.5l-6.5-7.5Z',
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.9, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
