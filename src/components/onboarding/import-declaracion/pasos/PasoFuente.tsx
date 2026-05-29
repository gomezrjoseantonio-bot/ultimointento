/**
 * PasoFuente.tsx · Wizard import XML V2 · paso 1 (§ 4.4).
 * Subir XML(s) AEAT y opcionalmente PDF · validación + parseo.
 */

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Check, X, AlertCircle, Lightbulb } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import styles from '../WizardImportarDeclaracion.module.css';

function fmtEuro(n?: number): string {
  if (n === undefined || n === null) return '';
  const signo = n >= 0 ? '+' : '−';
  return `${signo}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const PasoFuente: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);
  const [smartCerrado, setSmartCerrado] = useState(false);

  const validos = s.archivos.filter((a) => a.estado === 'validado');
  const ejercicios = s.declaraciones.map((d) => d.meta.ejercicio).sort((a, b) => a - b);
  const rangoEjercicios = ejercicios.length ? `${ejercicios[0]}-${ejercicios[ejercicios.length - 1]}` : '—';

  const onSelect = (files: FileList | null) => {
    if (files && files.length) void s.agregarArchivos(files);
  };

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>01</span> Sube tu declaración IRPF
      </div>
      <div className={styles.stepSub}>
        ATLAS lee XML AEAT (Modelo 100 · Sede Electrónica · DeclaVisor / Renta Web) y opcionalmente
        PDF · puedes subir varios ejercicios a la vez · cada uno enriquecerá los datos del anterior.
        Si solo tienes el PDF, usa el wizard de Corrección desde el detalle del ejercicio.
      </div>

      <div
        className={`${styles.uploadArea} ${dragover ? styles.dragover : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragover(false);
          onSelect(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => onSelect(e.target.files)}
        />
        <div className={styles.uploadIcon}>
          <UploadCloud size={22} strokeWidth={1.8} />
        </div>
        <div className={styles.uploadTitle}>Arrastra aquí tus archivos · o haz click para seleccionar</div>
        <div className={styles.uploadSub}>
          XML AEAT (uno por ejercicio) · PDF de la declaración (opcional · enriquece datos)
        </div>
        <span className={styles.uploadCta}>
          <FileText size={13} /> Seleccionar archivos
        </span>
      </div>

      {s.archivos.length > 0 && (
        <>
          <div className={styles.secTitle}>
            Archivos subidos · {s.declaraciones.length} ejercicios detectados
            {ejercicios.length > 0 && <span className={styles.count}>{rangoEjercicios}</span>}
          </div>

          <div className={styles.uploadList}>
            {s.archivos.map((a) => {
              const esError = a.estado === 'error';
              const meta = esError
                ? a.error
                : a.tipo === 'pdf'
                  ? 'PDF de declaración · adjunto · enriquecerá nombres y conceptos'
                  : `Modelo 100 · ejercicio ${a.ejercicio ?? '—'}${a.tipoDeclaracion ? ` · tipo ${a.tipoDeclaracion}` : ''}${a.resultado !== undefined ? ` · resultado ${fmtEuro(a.resultado)}` : ''}`;
              return (
                <div key={a.id} className={styles.uploadItem}>
                  <div className={`${styles.uploadItemIcon} ${esError ? styles.err : ''}`}>
                    {esError ? <AlertCircle size={13} /> : <Check size={13} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div className={styles.uploadItemName}>{a.nombre}</div>
                    <div className={styles.uploadItemMeta}>{meta}</div>
                  </div>
                  <div className={styles.uploadItemMeta}>{a.tamanoKB} KB</div>
                  <div className={`${styles.uploadItemStatus} ${esError ? styles.err : ''}`}>
                    {esError ? 'ERROR' : 'VALIDADO'}
                  </div>
                  <button
                    type="button"
                    className={styles.uploadItemRemove}
                    aria-label={`Quitar ${a.nombre}`}
                    onClick={() => s.quitarArchivo(a.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {validos.length > 0 && !smartCerrado && (
        <div className={styles.smart} style={{ marginTop: 16 }}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>ATLAS configurará tu cartera con los ejercicios subidos · </strong>
            los importará cronológicamente para que los datos más recientes ganen cuando haya
            descuadre. Los pasos siguientes solo muestran lo que el XML contiene · puedes saltar los
            que no apliquen.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoFuente;
