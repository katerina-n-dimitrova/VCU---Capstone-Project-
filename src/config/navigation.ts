import type { IconName } from '../components/common/Icon';

export interface NavItem {
  to: string;
  /** Full label, used in the sidebar and as the accessible name. */
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel: string;
  icon: IconName;
  /** One line describing the page, used as the page description. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: 'gauge',
    description: 'How the vehicle is doing right now, and anything that needs attention.',
  },
  {
    to: '/faults',
    label: 'Active Faults',
    shortLabel: 'Faults',
    icon: 'alert-triangle',
    description:
      'Every fault the vehicle controller has reported, with likely causes and what to check.',
  },
  {
    to: '/live',
    label: 'Live Data',
    shortLabel: 'Live',
    icon: 'activity',
    description: 'All measurements as they arrive, with their units, normal ranges and sources.',
  },
  {
    to: '/analysis',
    label: 'Analysis',
    shortLabel: 'Analysis',
    icon: 'chart',
    description: 'Measurements over time, so a problem can be traced back to what led up to it.',
  },
  {
    to: '/location',
    label: 'Location',
    shortLabel: 'Location',
    icon: 'map-pin',
    description: 'Where the vehicle is, with an offline fallback when map tiles cannot load.',
  },
  {
    to: '/system',
    label: 'System Status',
    shortLabel: 'System',
    icon: 'server',
    description: 'The state of each part of the system and the link between them.',
  },
];
