import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Icons } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import {
  exportBackup,
  readBackupFile,
  importBackup,
  getUltimaCopia,
  copiaEsAntigua,
  BackupError,
  type BackupPreview,
  type UltimaCopiaInfo,
} from '../../../services/db/backup';
import containerStyles from '../AjustesPage.module.css';
import styles from './CopiaSeguridad.module.css';

// NOTA · feedback con react-hot-toast (montado app-wide en App.tsx), igual que
// DatosPage: el <ToastHost> v5 sólo se monta en onboarding/dev.

const nf = new Intl.NumberFormat('es-ES');

const formatFecha = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const haceCuanto = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const dias = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  return `hace ${dias} días`;
};

const CopiaSeguridad: React.FC = () => {
  const [ultimaCopia, setUltimaCopia] = useState<UltimaCopiaInfo | null>(() => getUltimaCopia());
  const [isExporting, setIsExporting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [hasDownloadedCurrent, setHasDownloadedCurrent] = useState(false);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshMeta = useCallback(() => setUltimaCopia(getUltimaCopia()), []);

  const antigua = copiaEsAntigua(ultimaCopia);

  // ── Descargar copia (§5 · acción principal) ────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { totalRegistros } = await exportBackup();
      refreshMeta();
      toast.success(`Copia descargada · ${nf.format(totalRegistros)} registros`);
    } catch (error) {
      toast.error(
        'No se pudo descargar la copia: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
      );
    } finally {
      setIsExporting(false);
    }
  };

  // ── Elegir fichero → leer y mostrar (§3.1 · sin escribir) ──────────────────
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite re-seleccionar el mismo fichero
    if (!file) return;

    setIsReading(true);
    setPreview(null);
    setHasDownloadedCurrent(false);
    try {
      const p = await readBackupFile(file);
      setPreview(p);
    } catch (error) {
      // Fichero no-ATLAS o versión más nueva → mensaje claro, no error de consola.
      toast.error(error instanceof BackupError ? error.message : 'No se pudo leer el archivo');
    } finally {
      setIsReading(false);
    }
  };

  const cancelarPreview = () => {
    setPreview(null);
    setHasDownloadedCurrent(false);
  };

  // ── Copia obligatoria de lo actual ANTES de reemplazar (§3.1) ──────────────
  const handleDownloadCurrent = async () => {
    setDownloadingCurrent(true);
    try {
      const { totalRegistros } = await exportBackup();
      refreshMeta();
      setHasDownloadedCurrent(true);
      toast.success(`Copia de seguridad descargada · ${nf.format(totalRegistros)} registros`);
    } catch (error) {
      toast.error(
        'No se pudo descargar la copia previa: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
      );
    } finally {
      setDownloadingCurrent(false);
    }
  };

  // ── Reemplazar (habilitado sólo tras descargar la copia previa) ────────────
  const handleReplace = async () => {
    if (!preview || !hasDownloadedCurrent) return;
    setIsImporting(true);
    try {
      const { totalRegistros } = await importBackup(preview.archivo);
      toast.success(`Restauración completada · ${nf.format(totalRegistros)} registros. Recargando…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error(error instanceof BackupError ? error.message : 'No se pudo restaurar la copia');
      setIsImporting(false);
    }
  };

  useEffect(() => {
    // Al montar, refresca por si otra pestaña hizo copia.
    refreshMeta();
  }, [refreshMeta]);

  return (
    <>
      {/* §4 · aviso discreto y persistente de copia antigua (no modal) */}
      {antigua && (
        <div className={styles.avisoAntigua} role="status">
          <Icons.Warning size={16} strokeWidth={1.7} className={styles.avisoIcon} />
          <span className={styles.avisoText}>
            {ultimaCopia
              ? `Tu última copia es de ${haceCuanto(ultimaCopia.exportadoEl)}. Descarga una nueva para no perder datos.`
              : 'Nunca has hecho una copia de seguridad. Descarga una para proteger tus datos.'}
          </span>
          <button
            type="button"
            className={containerStyles.btnGhost}
            onClick={handleExport}
            disabled={isExporting}
          >
            <Icons.Archivo size={14} strokeWidth={1.7} />
            {isExporting ? 'Descargando…' : 'Descargar copia'}
          </button>
        </div>
      )}

      {/* Estado · cuándo fue la última copia */}
      <SetSection title="Estado" sub="cuándo hiciste la última copia de seguridad">
        <div className={styles.block}>
          <div className={styles.metaRow}>
            <Icons.Archivo size={18} strokeWidth={1.7} className={styles.metaIcon} />
            <div>
              {ultimaCopia ? (
                <>
                  <div className={styles.metaTitle}>
                    Última copia: {haceCuanto(ultimaCopia.exportadoEl)}
                  </div>
                  <div className={styles.metaSub}>
                    {formatFecha(ultimaCopia.exportadoEl)} · {nf.format(ultimaCopia.totalRegistros)}{' '}
                    registros
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.metaTitle}>Todavía no has hecho ninguna copia</div>
                  <div className={styles.metaSub}>
                    Descarga una copia para poder restaurar tus datos más adelante.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SetSection>

      {/* Descargar copia */}
      <SetSection
        title="Descargar copia"
        sub="guarda todos tus datos en un único fichero .json"
      >
        <div className={styles.block}>
          <div className={styles.blockDesc}>
            Descarga un fichero <code>atlas-copia-….json</code> con todos tus datos: inmuebles,
            contratos, tesorería, fiscalidad, documentos (con sus archivos) y preferencias. El
            fichero se queda en tu equipo · no se sube a ningún sitio.
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={containerStyles.btnGold}
              onClick={handleExport}
              disabled={isExporting}
            >
              <Icons.Archivo size={15} strokeWidth={1.7} />
              {isExporting ? 'Descargando…' : 'Descargar copia'}
            </button>
          </div>
        </div>
      </SetSection>

      {/* Restaurar desde un fichero */}
      <SetSection
        title="Restaurar desde un fichero"
        sub="reemplaza TODOS tus datos actuales por los de una copia"
        danger
      >
        {!preview ? (
          <div className={styles.block}>
            <div className={styles.blockDesc}>
              Elige un fichero de copia. Antes de reemplazar nada, te enseñaremos qué contiene y qué
              se perdería.
            </div>
            <div className={styles.actions}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                aria-label="Restaurar desde un fichero de copia (.json)"
                onChange={handleFile}
                disabled={isReading}
                className={styles.fileInput}
              />
              {isReading && <span className={styles.hint}>Leyendo…</span>}
            </div>
          </div>
        ) : (
          <div className={styles.block}>
            <div className={styles.previewHead}>
              Copia del {formatFecha(preview.exportadoEl)}
            </div>
            <div className={styles.previewVersion}>
              Versión de base {preview.dbVersionCopia} · la tuya es {preview.dbVersionActual}
              {preview.compatibilidad === 'antigua' && (
                <span className={styles.previewTag}> · copia más antigua</span>
              )}
            </div>

            <div className={styles.previewTable}>
              {Object.entries(preview.resumen)
                .filter(([, n]) => n > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([store, n]) => (
                  <div className={styles.previewRow} key={store}>
                    <span className={styles.previewStore}>{store}</span>
                    <span className={styles.previewCount}>{nf.format(n)}</span>
                  </div>
                ))}
              <div className={[styles.previewRow, styles.previewTotal].join(' ')}>
                <span className={styles.previewStore}>Total</span>
                <span className={styles.previewCount}>
                  {nf.format(preview.totalRegistros)} registros
                </span>
              </div>
            </div>

            <div className={styles.previewWarn}>
              <strong>Esto reemplaza todo lo que tienes ahora.</strong> Tu base actual tiene{' '}
              {nf.format(preview.totalActual)} registros y se va a perder.
            </div>

            {preview.compatibilidad === 'antigua' && (
              <div className={styles.previewNote}>
                La copia es de una versión anterior. Se restaurará y, al recargar, ATLAS aplicará
                las migraciones automáticas idempotentes que falten.
              </div>
            )}

            <ol className={styles.steps}>
              <li className={hasDownloadedCurrent ? styles.stepDone : ''}>
                <div className={styles.stepText}>
                  <strong>1 · Descarga primero una copia de lo que tienes ahora.</strong> Obligatorio
                  antes de reemplazar.
                </div>
                <button
                  type="button"
                  className={containerStyles.btnGhost}
                  onClick={handleDownloadCurrent}
                  disabled={downloadingCurrent || hasDownloadedCurrent}
                >
                  {hasDownloadedCurrent ? (
                    <>
                      <Icons.Success size={15} strokeWidth={1.7} />
                      Copia descargada
                    </>
                  ) : (
                    <>
                      <Icons.Archivo size={15} strokeWidth={1.7} />
                      {downloadingCurrent ? 'Descargando…' : 'Descargar copia de lo que tengo ahora'}
                    </>
                  )}
                </button>
              </li>
              <li>
                <div className={styles.stepText}>
                  <strong>2 · Reemplaza.</strong> Se vacía la base y se escribe la copia. Si algo
                  falla, la base queda como estaba.
                </div>
                <div className={styles.stepActions}>
                  <button
                    type="button"
                    className={containerStyles.btnDanger}
                    onClick={handleReplace}
                    disabled={!hasDownloadedCurrent || isImporting}
                  >
                    <Icons.Refresh size={15} strokeWidth={1.7} />
                    {isImporting ? 'Reemplazando…' : 'Reemplazar'}
                  </button>
                  <button
                    type="button"
                    className={containerStyles.btnGhost}
                    onClick={cancelarPreview}
                    disabled={isImporting}
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            </ol>
          </div>
        )}
      </SetSection>
    </>
  );
};

export default CopiaSeguridad;
export { CopiaSeguridad };
