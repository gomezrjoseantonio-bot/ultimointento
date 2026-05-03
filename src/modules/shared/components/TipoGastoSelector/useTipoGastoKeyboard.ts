import { type KeyboardEvent, useCallback } from 'react';

interface UseKeyboardOptions {
  isOpen: boolean;
  itemCount: number;
  focusedIndex: number;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (index: number) => void;
  onFocus: (index: number) => void;
}

export function useTipoGastoKeyboard({
  isOpen,
  itemCount,
  focusedIndex,
  onOpen,
  onClose,
  onSelect,
  onFocus,
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          onOpen();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onFocus(Math.min(focusedIndex + 1, itemCount - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onFocus(Math.max(focusedIndex - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0) onSelect(focusedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          onClose();
          break;
        default:
          break;
      }
    },
    [isOpen, itemCount, focusedIndex, onOpen, onClose, onSelect, onFocus],
  );

  return { handleKeyDown };
}
