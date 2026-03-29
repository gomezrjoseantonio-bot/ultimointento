import { useTheme } from '../contexts/ThemeContext';

export const useButtonStyles = () => {
  const { currentModule } = useTheme();

  return {
    primary: 'btn-primary-horizon',
    secondary: 'btn-secondary-horizon',
    ghost: 'btn-ghost-horizon',
    accent: 'btn-accent-horizon',
    danger: 'btn-danger',
    dangerOutline: 'btn-danger-outline',
    header: 'btn-header',
    focusRing: 'focus:ring-brand-navy',
    currentModule,
  };
};
