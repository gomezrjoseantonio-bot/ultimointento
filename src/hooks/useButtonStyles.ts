import { useTheme } from '../contexts/ThemeContext';

export const useButtonStyles = () => {
  const { currentModule } = useTheme();
  
  const getButtonClasses = () => {
    const isHorizon = currentModule === 'horizon';
    
    return {
      primary: isHorizon ? 'btn-primary-horizon' : 'btn-primary-pulse',
      secondary: isHorizon ? 'btn-secondary-horizon' : 'btn-secondary-pulse',
      ghost: isHorizon ? 'btn-ghost-horizon' : 'btn-ghost-pulse',
      danger: 'btn-danger',
      dangerOutline: 'btn-danger-outline',
    };
  };
  
  const getFocusRingColor = () => {
    return currentModule === 'horizon' ? 'focus:ring-brand-navy' : 'focus:ring-brand-teal';
  };
  
  return {
    ...getButtonClasses(),
    focusRing: getFocusRingColor(),
    currentModule,
  };
};