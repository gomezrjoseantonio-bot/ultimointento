import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type {
  TipoGastoSelectorProps,
  TipoGastoValue,
} from './TipoGastoSelector.types';
import { useTipoGastoKeyboard } from './useTipoGastoKeyboard';
import styles from './TipoGastoSelector.module.css';

const TipoGastoSelector: React.FC<TipoGastoSelectorProps> = ({
  catalog,
  value,
  onChange,
  error,
  disabled = false,
  id: externalId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const triggerId = externalId ?? `tgs-trigger-${generatedId}`;
  const listboxId = `tgs-listbox-${generatedId}`;

  const selectedTipo = catalog.find((t) => t.id === value?.tipoId) ?? null;

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus first item when opening
  useEffect(() => {
    if (isOpen) {
      const selected = catalog.findIndex((t) => t.id === value?.tipoId);
      setFocusedIndex(selected >= 0 ? selected : 0);
      panelRef.current?.focus();
    }
  }, [isOpen, catalog, value?.tipoId]);

  const handleOpen = useCallback(() => {
    if (!disabled) setIsOpen(true);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleSelectByIndex = useCallback(
    (index: number) => {
      const tipo = catalog[index];
      if (!tipo) return;
      const newValue: TipoGastoValue = {
        tipoId: tipo.id,
        subtipoId: '',
        nombrePersonalizado: '',
      };
      onChange(newValue);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [catalog, onChange],
  );

  const handleSelectTipo = useCallback(
    (tipoId: string) => {
      const index = catalog.findIndex((t) => t.id === tipoId);
      handleSelectByIndex(index);
    },
    [catalog, handleSelectByIndex],
  );

  const { handleKeyDown } = useTipoGastoKeyboard({
    isOpen,
    itemCount: catalog.length,
    focusedIndex,
    onOpen: handleOpen,
    onClose: handleClose,
    onSelect: handleSelectByIndex,
    onFocus: setFocusedIndex,
  });

  // Scroll focused option into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const options = panel.querySelectorAll<HTMLElement>('[role="option"]');
    const opt = options[focusedIndex];
    if (opt) {
      opt.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, isOpen]);

  const triggerLabel = selectedTipo ? selectedTipo.label : null;
  const TipoIcon = selectedTipo ? selectedTipo.icon : null;

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label="Tipo de gasto"
        disabled={disabled}
        className={[
          styles.trigger,
          isOpen ? styles.triggerOpen : '',
          error ? styles.triggerError : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
      >
        {TipoIcon && (
          <span className={styles.triggerIconBox} aria-hidden>
            <TipoIcon size={14} strokeWidth={2} />
          </span>
        )}
        <span
          className={[styles.triggerLabel, !triggerLabel ? styles.triggerPlaceholder : '']
            .filter(Boolean)
            .join(' ')}
        >
          {triggerLabel ?? '— Selecciona un tipo —'}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          className={[styles.triggerChevron, isOpen ? styles.triggerChevronOpen : '']
            .filter(Boolean)
            .join(' ')}
        />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label="Tipos de gasto"
          tabIndex={-1}
          className={styles.panel}
          onKeyDown={handleKeyDown}
        >
          {catalog.map((tipo, idx) => {
            const isSelected = tipo.id === value?.tipoId;
            const isFocused = idx === focusedIndex;
            const Icon = tipo.icon;
            return (
              <button
                key={tipo.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  styles.option,
                  isSelected ? styles.optionSelected : '',
                  isFocused && !isSelected ? styles.optionFocused : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelectTipo(tipo.id)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className={styles.optionIconBox} aria-hidden>
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{tipo.label}</span>
                  <span className={styles.optionDesc}>{tipo.description}</span>
                </span>
                {isSelected && (
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    className={styles.optionCheck}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
};

export default TipoGastoSelector;
