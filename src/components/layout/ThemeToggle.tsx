import { Icon } from '../common/Icon';
import { useTheme, type ThemePreference } from '../../state/useTheme';

const NEXT_LABEL: Record<ThemePreference, string> = {
  system: 'Switch to light theme',
  light: 'Switch to dark theme',
  dark: 'Follow the device theme',
};

const CURRENT_LABEL: Record<ThemePreference, string> = {
  system: 'Theme: follows device',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      onClick={cycle}
      title={`${CURRENT_LABEL[preference]}. ${NEXT_LABEL[preference]}.`}
    >
      <Icon name={preference === 'dark' ? 'moon' : 'sun'} size={19} />
      <span className="sr-only">{NEXT_LABEL[preference]}</span>
    </button>
  );
}
