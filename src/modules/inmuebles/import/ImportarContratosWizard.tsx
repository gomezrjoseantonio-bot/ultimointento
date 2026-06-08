// Importador de contratos · 3 pasos (FIX P5 · sin paso "Origen").
//   1 Subir fichero (entrada única · multi-fichero · autodetección por cabecera)
//   2 Revisión y mapeo
//   3 Confirmar
// El formato (Rentila / Plantilla ATLAS) se reconoce SOLO por las cabeceras
// (huella de cada parser) · pueden mezclarse en el mismo lote · un fichero no
// reconocido se lista como incidencia con la plantilla a mano y NO bloquea al
// resto. La card "Otro Excel" (mapeo manual) se ELIMINA.
//
// FIX P1 · cuando se entra desde /empezar (`?from=empezar`) el wizard aprende a
// volver al bloque de onboarding al confirmar (marca progreso) o al cancelar
// (sin marcar). Sin `from` · comportamiento de siempre intacto.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet,
  Link2, UploadCloud, X, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './ImportarContratosWizard.module.css';
import {
  detectarYParsearContrato, FicheroDetectado,
} from '../../../services/contractImportDetectService';
import {
  ContractDraft, InmuebleOpcion, construirDraftsRentila, construirDraftsAtlas, listarInmueblesOpciones,
} from '../../../services/contractDraftService';
import {
  crearContractsDesdeDrafts, combinarResultados, resultadoVacio, ResultadoCreacion,
} from '../../../services/contractImportCreationService';
import PasoRevision from './PasoRevision';

interface ImportarContratosWizardProps {
  onBack: () => void;
  onComplete: () => void;
}

const cx = (...classes: Array<string | false | undefined>): string => classes.filter(Boolean).join(' ');

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
};

// Plantilla ATLAS · fichero estático servido desde public/templates/.
const descargarPlantillaAtlas = (): void => {
  const base = process.env.PUBLIC_URL || '';
  const a = document.createElement('a');
  a.href = `${base}/templates/plantilla-contratos-atlas.xlsx`;
  a.download = 'plantilla-contratos-atlas.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const ImportarContratosWizard: React.FC<ImportarContratosWizardProps> = ({ onBack, onComplete }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';

  const [step, setStep] = useState<number>(1);
  const [ficheros, setFicheros] = useState<FicheroDetectado[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [drafts, setDrafts] = useState<ContractDraft[]>([]);
  const [inmuebleOpciones, setInmuebleOpciones] = useState<InmuebleOpcion[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCreacion>(resultadoVacio);

  const reconocidos = useMemo(() => ficheros.filter((f) => f.formato !== 'desconocido'), [ficheros]);
  const totalContratos = useMemo(() => reconocidos.reduce((sum, f) => sum + f.contratos, 0), [reconocidos]);
  const puedeContinuar = totalContratos > 0;

  // ── P1 · destinos según origen (onboarding vs uso normal) ──
  const volverAlSalir = useCallback(() => {
    if (fromEmpezar) navigate('/empezar/contratos');
    else onBack();
  }, [fromEmpezar, navigate, onBack]);

  const finalizar = useCallback(() => {
    onComplete();
    if (fromEmpezar) navigate('/empezar/contratos?done=import');
    else navigate('/contratos?tab=conciliar');
  }, [fromEmpezar, navigate, onComplete]);

  // ── Paso 1 · subida única multi-fichero con autodetección por cabecera ──
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const yaExiste = (f: File) =>
      ficheros.some((x) => x.file.name === f.name && x.file.size === f.size);

    const nuevos: File[] = [];
    for (const file of Array.from(fileList)) {
      if (yaExiste(file) || nuevos.some((n) => n.name === file.name && n.size === file.size)) {
        toast.error(`"${file.name}" ya está en la lista`);
        continue;
      }
      nuevos.push(file);
    }
    if (!nuevos.length) return;

    setProcesando(true);
    try {
      const procesados = await Promise.all(nuevos.map((file) => detectarYParsearContrato(file)));
      setFicheros((prev) => [...prev, ...procesados]);
    } finally {
      setProcesando(false);
    }
  }, [ficheros]);

  const removeFile = (name: string, size: number) =>
    setFicheros((prev) => prev.filter((f) => !(f.file.name === name && f.file.size === size)));

  const irAPaso = (n: number) => setStep(n);

  // Construye los drafts (fuzzy match + duplicados) de TODOS los ficheros
  // reconocidos (Rentila + plantilla ATLAS, mezclados) antes de entrar al paso 2.
  const irARevision = useCallback(async () => {
    setPreparando(true);
    try {
      const rentilaRows = reconocidos.flatMap((f) => f.rentilaRows ?? []);
      const atlasRows = reconocidos.flatMap((f) => f.atlasRows ?? []);
      const [draftsRentila, draftsAtlas, opciones] = await Promise.all([
        rentilaRows.length ? construirDraftsRentila(rentilaRows) : Promise.resolve([] as ContractDraft[]),
        atlasRows.length ? construirDraftsAtlas(atlasRows) : Promise.resolve([] as ContractDraft[]),
        listarInmueblesOpciones(),
      ]);
      setDrafts([...draftsRentila, ...draftsAtlas]);
      setInmuebleOpciones(opciones);
      setStep(2);
    } catch (error) {
      console.error('[ImportarContratos] preparar revisión falló:', error);
      toast.error('No se pudieron preparar los contratos para revisión');
    } finally {
      setPreparando(false);
    }
  }, [reconocidos]);

  // Crea los Contracts de una sección (estado SIN FIRMAR) y dispara la
  // vinculación retrospectiva al bote. Acumula el resultado para el paso final.
  const crearDrafts = useCallback(async (seleccion: ContractDraft[]) => {
    try {
      const parcial = await crearContractsDesdeDrafts(seleccion);
      setResultado((prev) => combinarResultados(prev, parcial));
    } catch (error) {
      toast.error('No se pudieron crear algunos contratos');
      throw error;
    }
  }, []);

  // Para el chip informativo del paso de revisión: 'rentila' solo si TODOS los
  // ficheros reconocidos son Rentila (preserva el comportamiento anterior).
  const origenRevision: 'rentila' | 'plantilla_atlas' | undefined = useMemo(() => {
    if (!reconocidos.length) return undefined;
    if (reconocidos.every((f) => f.formato === 'rentila')) return 'rentila';
    if (reconocidos.every((f) => f.formato === 'plantilla_atlas')) return 'plantilla_atlas';
    return undefined;
  }, [reconocidos]);

  // ── Stepper (3 pasos) ──
  const pasos = ['Subir fichero', 'Revisión y mapeo', 'Confirmar'];
  const renderStepper = () => (
    <div className={styles.stepper}>
      {pasos.map((label, i) => {
        const idx = i + 1;
        return (
          <React.Fragment key={label}>
            <button
              type="button"
              className={cx(styles.stepInd, idx === step && styles.active, idx < step && styles.done)}
              onClick={() => idx < step && irAPaso(idx)}
            >
              <span className={styles.stepNum}>{idx}</span>
              {label}
            </button>
            {idx < pasos.length && <span className={styles.stepSep} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const formatoLabel = (f: FicheroDetectado): string =>
    f.formato === 'rentila' ? 'Rentila' : 'Plantilla ATLAS';

  // ── Paso 1 · subir ──
  const renderPaso1 = () => (
    <section className={styles.stepContent}>
      <div className={styles.panel}>
        <div className={styles.panelH}>Sube tus contratos</div>
        <div className={styles.panelSub}>
          Arrastra tus exportaciones de Rentila o la plantilla ATLAS rellenada · puedes mezclar varios ficheros.
          ATLAS reconoce el formato de cada uno por sus cabeceras · no tienes que declarar nada. Acepta .xlsx y .xls.
        </div>

        {/* Descarga de la plantilla · vive en el paso Subir (FIX P5) */}
        <div className={styles.panelSection}>
          <div className={styles.templateRow}>
            <div className={styles.templateIcon}><FileSpreadsheet size={20} strokeWidth={1.5} /></div>
            <div className={styles.templateInfo}>
              <div className={styles.templateH}>¿No usas Rentila? Descarga la plantilla ATLAS</div>
              <div className={styles.templateSub}>Rellena una fila por contrato y súbela aquí · columnas compatibles con tus inmuebles.</div>
            </div>
            <button type="button" className={cx(styles.btn, styles.btnGold, styles.btnSm)} onClick={descargarPlantillaAtlas}>
              <Download size={14} /> Descargar plantilla
            </button>
          </div>
        </div>

        <div className={styles.panelSection}>
          <div
            className={cx(styles.dropzone, dragging && styles.dragging)}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
            <div className={styles.dzIcon}><UploadCloud size={28} strokeWidth={1.5} /></div>
            <div className={styles.dzH}>Arrastra tus Excel o haz clic para seleccionar</div>
            <div className={styles.dzSub}>Rentila (activos + archivados) y/o plantilla ATLAS · varios ficheros · hasta 10 MB cada uno</div>
            <div className={styles.dzFormat}>.xlsx · .xls</div>
          </div>
        </div>

        {ficheros.length > 0 && (
          <div className={styles.panelSection}>
            <div className={styles.panelSectionH}>Ficheros subidos</div>
            <div className={styles.fileList}>
              {ficheros.map((f) => (
                <div key={`${f.file.name}-${f.file.size}`} className={styles.fileItem}>
                  <div className={styles.fileItemIcon}>
                    {f.formato === 'desconocido'
                      ? <AlertCircle size={18} strokeWidth={1.5} className={styles.warn} />
                      : <FileSpreadsheet size={18} strokeWidth={1.5} />}
                  </div>
                  <div className={styles.fileItemInfo}>
                    <div className={styles.fileItemName}>{f.file.name}</div>
                    {f.formato === 'desconocido' ? (
                      <div className={styles.fileItemMeta}>
                        <span className={styles.warn}>{f.error}</span>{' '}
                        <button type="button" className={styles.btnLink} onClick={descargarPlantillaAtlas}>
                          descargar plantilla ATLAS
                        </button>
                      </div>
                    ) : (
                      <div className={styles.fileItemMeta}>
                        <span className={styles.mono}>{formatBytes(f.file.size)}</span> ·{' '}
                        <span className={styles.pillOk}>{formatoLabel(f)} · {f.contratos} contratos</span>
                      </div>
                    )}
                  </div>
                  <button type="button" className={styles.fileItemRemove} title="Quitar" onClick={() => removeFile(f.file.name, f.file.size)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            {totalContratos > 0 && (
              <div className={styles.fileTotal}>
                <CheckCircle2 size={14} className={styles.pillOk} />
                <span><strong>{totalContratos} contratos</strong> listos para revisión en el siguiente paso.</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.wizFoot}>
          <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={volverAlSalir}>
            <ArrowLeft size={14} /> {fromEmpezar ? 'Volver a Empezar' : 'Cancelar'}
          </button>
          <div className={styles.wizFootInfo}>
            {procesando ? 'Reconociendo formato…' : `${reconocidos.length} ficheros · ${totalContratos} contratos detectados`}
          </div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} disabled={!puedeContinuar || preparando || procesando} onClick={irARevision}>
            {preparando ? 'Preparando...' : 'Continuar a revisión'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onClick={volverAlSalir}>
        <ArrowLeft size={14} /> {fromEmpezar ? 'Volver a Empezar' : 'Volver a inmuebles'}
      </button>
      <h1 className={styles.title}>Importar contratos de alquiler</h1>
      <p className={styles.sub}>
        Sube tus contratos desde Rentila o la plantilla de ATLAS. ATLAS reconoce el formato solo y los revisa contigo antes de crearlos para evitar duplicados y errores.
      </p>

      {renderStepper()}

      {step === 1 && renderPaso1()}
      {step === 2 && (
        <PasoRevision
          drafts={drafts}
          inmuebleOpciones={inmuebleOpciones}
          origen={origenRevision}
          onCrear={crearDrafts}
          onContinuar={() => irAPaso(3)}
          onAtras={() => irAPaso(1)}
        />
      )}
      {step === 3 && (
        <section className={styles.stepContent}>
          <div className={styles.panel}>
            <div className={styles.finalHero}>
              <div className={styles.finalIcon}><CheckCircle2 size={28} strokeWidth={1.6} /></div>
              <div>
                <div className={styles.panelH}>Listo · {resultado.creados} contratos importados</div>
                <div className={styles.panelSub}>
                  {resultado.omitidos > 0
                    ? `${resultado.omitidos} duplicados se omitieron · `
                    : ''}
                  todos los demás están ya en ATLAS como SIN FIRMAR.
                </div>
              </div>
            </div>

            <div className={styles.panelSection}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Contratos creados</span>
                  <span className={cx(styles.summaryVal, styles.pos)}>{resultado.creados}</span>
                </div>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Duplicados omitidos</span>
                  <span className={cx(styles.summaryVal, styles.neg)}>{resultado.omitidos}</span>
                </div>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Inquilinos nuevos</span>
                  <span className={styles.summaryVal}>{resultado.inquilinosNuevos}</span>
                </div>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Inmuebles afectados</span>
                  <span className={styles.summaryVal}>{resultado.inmueblesAfectados.length}</span>
                </div>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Renta mensual total</span>
                  <span className={styles.summaryVal}>
                    {resultado.rentaMensualTotal.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                  </span>
                </div>
                <div className={styles.summaryLine}>
                  <span className={styles.summaryKey}>Estado</span>
                  <span className={cx(styles.summaryVal, styles.warn)}>Sin firmar · editables</span>
                </div>
              </div>

              {resultado.botesConSugerencia.length > 0 && (
                <div className={styles.summaryBanner}>
                  <Link2 size={18} className={styles.summaryBannerIcon} />
                  <div>
                    <div className={styles.summaryBannerH}>
                      {resultado.botesConSugerencia.length} botes pueden vincularse en Por conciliar
                    </div>
                    <div className={styles.summaryBannerD}>
                      ATLAS ha detectado que estos contratos cubren rentas declaradas a Hacienda que aún no están identificadas. Ve a la pestaña Por conciliar para vincularlos y cuadrar la declaración fiscal de cada año.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.wizFoot}>
              <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={() => irAPaso(2)}><ArrowLeft size={14} /> Volver a revisión</button>
              <div />
              <button
                type="button"
                className={cx(styles.btn, styles.btnGold)}
                onClick={finalizar}
              >
                <ArrowRight size={14} /> {fromEmpezar ? 'Volver a Empezar' : 'Ir a Por conciliar'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ImportarContratosWizard;
