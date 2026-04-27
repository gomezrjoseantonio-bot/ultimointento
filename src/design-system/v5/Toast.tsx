import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

export interface ToastMessage {
  id: number;
  message: React.ReactNode;
  variant: ToastVariant;
  duration: number;
}

export interface ToastProps {
  message: React.ReactNode;
  variant?: ToastVariant;
  /** Si true · animación visible. */
  show?: boolean;
}

/**
 * Tarjeta toast individual · estilo guía v5 §12.1.
 * Para uso imperativo · combinar con `<ToastHost>` y `showToastV5`.
 */
const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'info',
  show = true,
}) => {
  const classes = [
    styles.toast,
    styles[variant],
    show ? styles.show : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{message}</div>;
};

interface ToastHostState {
  push: (msg: Omit<ToastMessage, 'id'>) => void;
}

const hostRef: { current: ToastHostState | null } = { current: null };

/**
 * Host global · monta una vez en el árbol · expone API imperativa
 * `showToastV5(msg, variant)` desde cualquier sitio.
 */
export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    hostRef.current = {
      push: (msg) => {
        const id = ++counter.current;
        const next: ToastMessage = { id, ...msg };
        setItems((current) => [...current, next]);
        const timerId = window.setTimeout(() => {
          remove(id);
          timers.current = timers.current.filter((t) => t !== timerId);
        }, msg.duration);
        timers.current.push(timerId);
      },
    };
    return () => {
      hostRef.current = null;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [remove]);

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {items.map((item) => (
        <Toast key={item.id} message={item.message} variant={item.variant} show />
      ))}
    </div>
  );
};

/**
 * API imperativa · útil dentro de event handlers.
 * Si no hay `<ToastHost>` montado · usa `console.info` como fallback silencioso.
 */
export function showToastV5(
  message: React.ReactNode,
  variant: ToastVariant = 'info',
  duration = 2400,
): void {
  if (hostRef.current) {
    hostRef.current.push({ message, variant, duration });
  } else if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[atlas-v5 toast · sin host montado]', message);
  }
}

export default Toast;
export { Toast };
