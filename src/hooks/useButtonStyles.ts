import { useTheme } from '../contexts/ThemeContext';

export const useButtonStyles = () => {
  const { currentModule } = useTheme();
  
  const getButtonClasses = () => {
    // Both modules now use the same button styles (navy primary, teal accent)
    return {
      primary: 'btn-primary-horizon', // Both use navy primary
      secondary: 'btn-secondary-horizon', // Both use navy secondary
      ghost: 'btn-ghost-horizon', // Both use navy ghost
      accent: 'btn-accent-horizon', // Both use teal accent for secondary positive actions
      danger: 'btn-danger',
      dangerOutline: 'btn-danger-outline',
    };
  };
  
  const getFocusRingColor = () => {
    // Both modules use navy as primary focus color
    return 'focus:ring-brand-navy';
  };
  
  return {
    ...getButtonClasses(),
    focusRing: getFocusRingColor(),
    currentModule,
  };
};