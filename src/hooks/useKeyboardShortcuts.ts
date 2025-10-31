import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardShortcutsOptions {
  onShowShortcuts?: () => void;
}

/**
 * Global keyboard shortcuts hook
 * Provides navigation and action shortcuts throughout the app
 */
export const useKeyboardShortcuts = (options?: UseKeyboardShortcutsOptions) => {
  const navigate = useNavigate();
  const { onShowShortcuts } = options || {};

  useEffect(() => {
    let isGPressed = false;
    let gPressTimer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Show shortcuts modal with '?'
      if (e.key === '?' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      // Handle 'G' key for navigation shortcuts
      if (e.key === 'g' || e.key === 'G') {
        if (!isGPressed) {
          isGPressed = true;
          // Reset after 1.5 seconds if no second key is pressed
          gPressTimer = setTimeout(() => {
            isGPressed = false;
          }, 1500);
        }
        return;
      }

      // Handle navigation shortcuts after 'G' is pressed
      if (isGPressed) {
        clearTimeout(gPressTimer);
        isGPressed = false;

        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            navigate('/panel');
            break;
          case 'p':
            e.preventDefault();
            navigate('/portfolio');
            break;
          case 't':
            e.preventDefault();
            navigate('/treasury');
            break;
          case 'd':
            e.preventDefault();
            navigate('/inbox');
            break;
          case 's':
            e.preventDefault();
            navigate('/settings');
            break;
          default:
            break;
        }
        return;
      }

      // Save shortcut (Cmd+S or Ctrl+S)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        // Allow default browser behavior, but could be customized per page
        // e.preventDefault();
        // Trigger save action
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Reset G press state on key up
      if (e.key === 'g' || e.key === 'G') {
        // Don't reset immediately, wait for potential second key
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearTimeout(gPressTimer);
    };
  }, [navigate, onShowShortcuts]);
};
