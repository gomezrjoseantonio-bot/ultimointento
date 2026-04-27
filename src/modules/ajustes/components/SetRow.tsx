import React from 'react';
import styles from './SetRow.module.css';

export interface SetRowProps {
  /** Etiqueta a la izquierda · 180px de ancho. */
  label: React.ReactNode;
  /** Tono del label · default · muted · danger. */
  labelTone?: 'default' | 'muted' | 'danger';
  /** Contenido principal · valor · input · descripción. */
  children?: React.ReactNode;
  /** Slot derecho · típicamente un set-link · toggle · botón. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Fila estándar dentro de SetSection. Grid 180px / 1fr / auto.
 * Helpers exportados · `.Value`, `.ValueMono`, `.Sub`, `.Link`, `.Input`.
 */
const SetRow: React.FC<SetRowProps> & {
  Value: typeof Value;
  ValueMono: typeof ValueMono;
  Sub: typeof Sub;
  Link: typeof RowLink;
  Input: typeof RowInput;
} = ({ label, labelTone = 'default', children, trailing, className }) => {
  const labelCls = [
    styles.label,
    labelTone !== 'default' ? styles[labelTone] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.row, className ?? ''].filter(Boolean).join(' ')}>
      <div className={labelCls}>{label}</div>
      <div>{children}</div>
      <div>{trailing}</div>
    </div>
  );
};

interface ValueProps extends React.HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
  children: React.ReactNode;
}

const Value: React.FC<ValueProps> = ({ muted, className, children, ...rest }) => {
  const cls = [styles.value, muted ? styles.muted : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
};

const ValueMono: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={[styles.valueMono, className ?? ''].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </div>
);

const Sub: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={[styles.subtext, className ?? ''].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </div>
);

interface RowLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const RowLink: React.FC<RowLinkProps> = ({
  className,
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    className={[styles.link, className ?? ''].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </button>
);

interface RowInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

const RowInput: React.FC<RowInputProps> = ({
  mono,
  className,
  type = 'text',
  ...rest
}) => (
  <input
    type={type}
    className={[styles.input, mono ? styles.mono : '', className ?? '']
      .filter(Boolean)
      .join(' ')}
    {...rest}
  />
);

SetRow.Value = Value;
SetRow.ValueMono = ValueMono;
SetRow.Sub = Sub;
SetRow.Link = RowLink;
SetRow.Input = RowInput;

export default SetRow;
export { SetRow };
