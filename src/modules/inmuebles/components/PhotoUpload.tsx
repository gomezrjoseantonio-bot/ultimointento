import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, X } from 'lucide-react';
import { compressImage } from '../utils/compressImage';
import styles from './PhotoUpload.module.css';

interface Props {
  /** Foto actual en base64 · undefined si no hay */
  value?: string;
  /** Callback al cambiar foto · base64 nuevo · null para borrar */
  onChange: (foto: string | null) => void;
  /** Tamaño máximo final tras compresión (KB) · default 500 */
  maxSizeKB?: number;
  /** Texto alternativo para preview */
  alt?: string;
}

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const PhotoUpload: React.FC<Props> = ({ value, onChange, maxSizeKB = 500, alt }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const triggerPick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato no soportado · usa JPG, PNG o WebP');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error('Imagen demasiado grande · máximo 5MB');
      return;
    }

    try {
      setBusy(true);
      const compressed = await compressImage(file, maxSizeKB);
      onChange(compressed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error procesando la imagen';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={handleInputChange}
        className={styles.hiddenInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      {value ? (
        <div className={styles.preview}>
          <img src={value} alt={alt ?? 'Foto del inmueble'} className={styles.previewImg} />
          <div className={styles.previewActions}>
            <button
              type="button"
              onClick={triggerPick}
              disabled={busy}
              className={styles.btnGhost}
            >
              {busy ? 'Procesando…' : 'Cambiar'}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className={styles.btnDanger}
              aria-label="Eliminar foto"
            >
              <X size={14} strokeWidth={2} />
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={triggerPick}
          disabled={busy}
          className={styles.placeholder}
        >
          <ImagePlus size={28} strokeWidth={1.6} />
          <span className={styles.placeholderTitle}>
            {busy ? 'Procesando imagen…' : 'Añadir foto'}
          </span>
          <span className={styles.placeholderHint}>
            JPG · PNG · WebP · máx 5MB · se comprime a {maxSizeKB}KB
          </span>
        </button>
      )}
    </div>
  );
};

export default PhotoUpload;
