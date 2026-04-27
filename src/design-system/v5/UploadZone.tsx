import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import styles from './UploadZone.module.css';

export interface UploadZoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop' | 'title'> {
  /** Texto principal · ej "Suelta el archivo o haz clic para subir". */
  title?: React.ReactNode;
  /** Subtítulo · típos aceptados · límite de tamaño. */
  sub?: React.ReactNode;
  /** Mime types o extensiones · ej ".csv,.xlsx,application/pdf". */
  accept?: string;
  /** Permite seleccionar varios archivos. */
  multiple?: boolean;
  /** Callback con los archivos seleccionados o soltados. */
  onFiles: (files: File[]) => void;
  /** Si true · zona deshabilitada · sin hover ni drag. */
  disabled?: boolean;
  /** Icono custom · default Lucide `Upload`. */
  icon?: React.ReactNode;
  /** id del input · útil para `<label htmlFor>` externo. */
  inputId?: string;
}

/**
 * Zona drag-and-drop con borde dashed oro · §0.5 spec.
 * Click abre selector · drop acepta archivos · llama `onFiles` con array.
 */
const UploadZone: React.FC<UploadZoneProps> = ({
  title = (
    <>
      Suelta el archivo aquí o <strong>haz clic para subir</strong>
    </>
  ),
  sub,
  accept,
  multiple = false,
  onFiles,
  disabled = false,
  icon,
  inputId,
  className,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsOver(false);
      if (disabled) return;
      const list = Array.from(event.dataTransfer.files);
      if (list.length > 0) onFiles(list);
    },
    [onFiles, disabled],
  );

  const handleSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(event.target.files ?? []);
      if (list.length > 0) onFiles(list);
      // Reset · permite re-subir el mismo archivo.
      event.target.value = '';
    },
    [onFiles],
  );

  const handleKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled],
  );

  const classes = [
    styles.zone,
    isOver ? styles.dragOver : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={handleKey}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsOver(false);
      }}
      onDrop={handleDrop}
      {...rest}
    >
      <div className={styles.iconWrap}>{icon ?? <Upload size={20} strokeWidth={1.8} />}</div>
      <div className={styles.title}>{title}</div>
      {sub != null && <div className={styles.sub}>{sub}</div>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className={styles.input}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleSelect}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
};

export default UploadZone;
export { UploadZone };
