// Commit 5 · Wizard de 4 pasos del importador de contratos.
// Paso 1 (origen) + paso 2 (subida multi-fichero). Réplica de
// docs/mockups/atlas-importer-contratos-v4.html. Los pasos 3 y 4 se completan
// en los commits 6 y 8; aquí quedan como placeholders mínimos.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet,
  FileDown, FileQuestion, Info, UploadCloud, X, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import styles from './ImportarContratosWizard.module.css';
import { parseRentilaXlsx, RentilaRow, RentilaFormatError } from '../../../services/rentilaParserService';
import {
  parseAtlasTemplateXlsx, AtlasTemplateRow, AtlasTemplateFormatError,
} from '../../../services/atlasTemplateParserService';
import {
  ContractDraft, InmuebleOpcion, construirDraftsRentila, construirDraftsAtlas, listarInmueblesOpciones,
} from '../../../services/contractDraftService';
import PasoRevision from './PasoRevision';

interface ImportarContratosWizardProps {
  onBack: () => void;
  onComplete: () => void;
}

type Origen = 'rentila' | 'plantilla_atlas';

interface FicheroRentila {
  file: File;
  rows: RentilaRow[];
}
interface FicheroAtlas {
  file: File;
  rows: AtlasTemplateRow[];
}

const MAX_FICHEROS_RENTILA = 2;

const cx = (...classes: Array<string | false | undefined>): string => classes.filter(Boolean).join(' ');

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
};

const ImportarContratosWizard: React.FC<ImportarContratosWizardProps> = ({ onBack, onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [origen, setOrigen] = useState<Origen>('rentila');
  const [ficherosRentila, setFicherosRentila] = useState<FicheroRentila[]>([]);
  const [ficheroAtlas, setFicheroAtlas] = useState<FicheroAtlas | null>(null);

  const rentilaInputRef = useRef<HTMLInputElement>(null);
  const atlasInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [drafts, setDrafts] = useState<ContractDraft[]>([]);
  const [inmuebleOpciones, setInmuebleOpciones] = useState<InmuebleOpcion[]>([]);
  const [preparando, setPreparando] = useState(false);

  const totalContratos = useMemo(
    () =>
      origen === 'rentila'
        ? ficherosRentila.reduce((sum, f) => sum + f.rows.length, 0)
        : ficheroAtlas?.rows.length ?? 0,
    [origen, ficherosRentila, ficheroAtlas],
  );

  const puedeContinuarPaso2 = origen === 'rentila' ? ficherosRentila.length > 0 : ficheroAtlas != null;

  // ── Parseo de ficheros Rentila (multi) ──
  const addRentilaFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    for (const file of files) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast.error(`"${file.name}": formato no válido. Usa .xlsx o .xls`);
        continue;
      }
      setFicherosRentila((prev) => {
        if (prev.length >= MAX_FICHEROS_RENTILA) {
          toast.error(`Solo puedes subir ${MAX_FICHEROS_RENTILA} ficheros de Rentila (activos + archivados)`);
          return prev;
        }
        if (prev.some((f) => f.file.name === file.name && f.file.size === file.size)) {
          toast.error(`"${file.name}" ya está en la lista`);
          return prev;
        }
        return prev;
      });

      try {
        const rows = await parseRentilaXlsx(file);
        setFicherosRentila((prev) => {
          if (prev.length >= MAX_FICHEROS_RENTILA) return prev;
          if (prev.some((f) => f.file.name === file.name && f.file.size === file.size)) return prev;
          return [...prev, { file, rows }];
        });
      } catch (error) {
        if (error instanceof RentilaFormatError) {
          toast.error(`"${file.name}": ${error.message}`);
        } else {
          toast.error(`"${file.name}": no se pudo leer el Excel`);
        }
      }
    }
  }, []);

  const removeRentilaFile = (name: string, size: number) =>
    setFicherosRentila((prev) => prev.filter((f) => !(f.file.name === name && f.file.size === size)));

  // ── Parseo de fichero plantilla ATLAS (single) ──
  const setAtlasFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no válido. Usa .xlsx o .xls');
      return;
    }
    try {
      const rows = await parseAtlasTemplateXlsx(file);
      setFicheroAtlas({ file, rows });
    } catch (error) {
      if (error instanceof AtlasTemplateFormatError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo leer el Excel');
      }
    }
  }, []);

  // Plantilla ATLAS · descarga (commit 8 sustituye por fichero estático en public/).
  const descargarPlantillaAtlas = () => {
    const headers = [
      'Inmueble (nombre o ref. catastral)', 'Habitación', 'Tipo de contrato',
      'Fecha inicio', 'Fecha fin', 'Inquilino nombre completo', 'DNI/NIF inquilino',
      'Email inquilino', 'Teléfono inquilino', 'Renta mensual €', 'Fianza €',
    ];
    const ejemplos = [
      ['CB Sant Fruitós', 'Hab 2', 'Vivienda LAU', '01/01/2024', '31/12/2028', 'CONCEPCION RAMIREZ GUERERO', '53639208B', 'contacto@ejemplo.com', '+34 666 555 444', 330, 330],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    XLSX.writeFile(wb, 'plantilla-contratos-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  const irAPaso = (n: number) => setStep(n);

  // Construye los drafts (fuzzy match + duplicados) y carga las opciones de
  // inmueble antes de entrar en el paso 3.
  const irARevision = useCallback(async () => {
    setPreparando(true);
    try {
      const [nuevosDrafts, opciones] = await Promise.all([
        origen === 'rentila'
          ? construirDraftsRentila(ficherosRentila.flatMap((f) => f.rows))
          : construirDraftsAtlas(ficheroAtlas?.rows ?? []),
        listarInmueblesOpciones(),
      ]);
      setDrafts(nuevosDrafts);
      setInmuebleOpciones(opciones);
      setStep(3);
    } catch (error) {
      toast.error('No se pudieron preparar los contratos para revisión');
    } finally {
      setPreparando(false);
    }
  }, [origen, ficherosRentila, ficheroAtlas]);

  // Commit 6 · creación inyectada como placeholder (no toca BD). El commit 7 la
  // sustituye por crearContractsDesdeDrafts + postContractCreated.
  const crearDrafts = useCallback(async (_seleccion: ContractDraft[]) => {
    // Intencionadamente vacío hasta el commit 7.
  }, []);

  // ── Stepper ──
  const pasos = ['Origen', 'Subir fichero', 'Revisión y mapeo', 'Confirmar'];
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

  // ── Paso 1 · origen ──
  const renderPaso1 = () => (
    <section className={styles.stepContent}>
      <div className={styles.panel}>
        <div className={styles.panelH}>¿De dónde vienen tus contratos?</div>
        <div className={styles.panelSub}>
          Elige el origen para que ATLAS sepa cómo interpretar las columnas. Si tu fuente no aparece, descarga la plantilla de ATLAS.
        </div>

        <div className={styles.sourceGrid}>
          <button type="button" className={cx(styles.source, origen === 'rentila' && styles.selected)} onClick={() => setOrigen('rentila')}>
            <div className={styles.sourceIcon}><FileSpreadsheet size={20} strokeWidth={1.5} /></div>
            <div className={styles.sourceH}>Rentila</div>
            <div className={styles.sourceD}>Exportación directa del módulo Alquileres de Rentila · ATLAS reconoce las 12 columnas automáticamente.</div>
            <div className={styles.sourceFoot}><CheckCircle2 size={14} className={styles.pillOk} /> Formato auto-reconocido</div>
          </button>

          <button type="button" className={cx(styles.source, origen === 'plantilla_atlas' && styles.selected)} onClick={() => setOrigen('plantilla_atlas')}>
            <div className={styles.sourceIcon}><FileDown size={20} strokeWidth={1.5} /></div>
            <div className={styles.sourceH}>Plantilla ATLAS</div>
            <div className={styles.sourceD}>Plantilla Excel propia con las columnas que ATLAS usa internamente · ideal si no tienes Rentila.</div>
            <div className={styles.sourceFoot}><Download size={14} /> Descargar plantilla</div>
          </button>

          <button type="button" className={cx(styles.source, styles.disabled)} disabled title="Próximamente">
            <div className={styles.sourceIcon}><FileQuestion size={20} strokeWidth={1.5} /></div>
            <div className={styles.sourceH}>Otro Excel</div>
            <div className={styles.sourceD}>Sube tu propio Excel · ATLAS te pedirá mapear cada columna a un campo conocido en el siguiente paso.</div>
            <div className={styles.sourceFoot}><AlertCircle size={14} /> Próximamente</div>
          </button>
        </div>

        {origen === 'rentila' && (
          <div className={styles.panelSection}>
            <div className={styles.panelSectionH}>Qué espera ATLAS de Rentila</div>
            <div className={styles.infoBanner}>
              <Info size={16} />
              <div>
                Desde Rentila ve a <strong>Alquileres → Exportar</strong>, marca todas las columnas por defecto, descarga el Excel y súbelo aquí. ATLAS reconoce ID, propiedad, tipo, fechas, inquilino, alquiler, gastos y fianza. No necesitas reformatear nada.
              </div>
            </div>
          </div>
        )}

        <div className={styles.wizFoot}>
          <div className={styles.wizFootInfo}>1 de 4 · Origen</div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={() => irAPaso(2)}>
            Continuar <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );

  // ── Paso 2 · subida ──
  const renderPaso2Rentila = () => (
    <section className={styles.stepContent}>
      <div className={styles.panel}>
        <div className={styles.panelH}>Sube tus exportaciones de Rentila</div>
        <div className={styles.panelSub}>
          Rentila exporta los contratos activos y los archivados por separado · puedes subir ambos a la vez y ATLAS los procesa juntos. Acepta .xlsx y .xls.
        </div>

        <div className={styles.panelSection}>
          <div
            className={cx(styles.dropzone, dragging && styles.dragging)}
            onClick={() => rentilaInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addRentilaFiles(e.dataTransfer.files); }}
          >
            <input ref={rentilaInputRef} type="file" accept=".xlsx,.xls" multiple hidden onChange={(e) => e.target.files && addRentilaFiles(e.target.files)} />
            <div className={styles.dzIcon}><UploadCloud size={28} strokeWidth={1.5} /></div>
            <div className={styles.dzH}>Arrastra los Excel de Rentila o haz clic para seleccionar</div>
            <div className={styles.dzSub}>Puedes subir hasta 2 ficheros · activos y archivados · hasta 10 MB cada uno</div>
            <div className={styles.dzFormat}>.xlsx · .xls</div>
          </div>
        </div>

        {ficherosRentila.length > 0 && (
          <div className={styles.panelSection}>
            <div className={styles.panelSectionH}>Ficheros subidos</div>
            <div className={styles.fileList}>
              {ficherosRentila.map((f) => (
                <div key={`${f.file.name}-${f.file.size}`} className={styles.fileItem}>
                  <div className={styles.fileItemIcon}><FileSpreadsheet size={18} strokeWidth={1.5} /></div>
                  <div className={styles.fileItemInfo}>
                    <div className={styles.fileItemName}>{f.file.name}</div>
                    <div className={styles.fileItemMeta}>
                      <span className={styles.mono}>{formatBytes(f.file.size)}</span> · {f.rows.length} contratos detectados · <span className={styles.pillOk}>formato Rentila reconocido</span>
                    </div>
                  </div>
                  <button type="button" className={styles.fileItemRemove} title="Quitar" onClick={() => removeRentilaFile(f.file.name, f.file.size)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.fileTotal}>
              <CheckCircle2 size={14} className={styles.pillOk} />
              <span><strong>{totalContratos} contratos</strong> listos para revisión en el siguiente paso.</span>
            </div>
          </div>
        )}

        <div className={styles.wizFoot}>
          <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={() => irAPaso(1)}><ArrowLeft size={14} /> Atrás</button>
          <div className={styles.wizFootInfo}>{ficherosRentila.length} ficheros · {totalContratos} contratos detectados</div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} disabled={!puedeContinuarPaso2 || preparando} onClick={irARevision}>
            {preparando ? 'Preparando...' : 'Continuar a revisión'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );

  const renderPaso2Atlas = () => (
    <section className={styles.stepContent}>
      <div className={styles.panel}>
        <div className={styles.panelH}>Plantilla ATLAS</div>
        <div className={styles.panelSub}>Descarga la plantilla, rellénala con tus contratos y súbela aquí.</div>

        <div className={styles.panelSection}>
          <div className={styles.templateRow}>
            <div className={styles.templateIcon}><FileSpreadsheet size={20} strokeWidth={1.5} /></div>
            <div className={styles.templateInfo}>
              <div className={styles.templateH}>plantilla-contratos-atlas.xlsx</div>
              <div className={styles.templateSub}>11 columnas con ejemplos rellenados · compatible con todos los inmuebles que ya tienes en ATLAS</div>
            </div>
            <button type="button" className={cx(styles.btn, styles.btnGold, styles.btnSm)} onClick={descargarPlantillaAtlas}>
              <Download size={14} /> Descargar
            </button>
          </div>
        </div>

        <div className={styles.panelSection}>
          <div
            className={cx(styles.dropzone, dragging && styles.dragging)}
            onClick={() => atlasInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setAtlasFile(e.dataTransfer.files[0]); }}
          >
            <input ref={atlasInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && setAtlasFile(e.target.files[0])} />
            <div className={styles.dzIcon}><UploadCloud size={28} strokeWidth={1.5} /></div>
            <div className={styles.dzH}>Sube la plantilla ATLAS rellenada</div>
            <div className={styles.dzSub}>Hasta 10 MB · una hoja por fichero</div>
            <div className={styles.dzFormat}>.xlsx · .xls</div>
          </div>
        </div>

        {ficheroAtlas && (
          <div className={styles.panelSection}>
            <div className={styles.panelSectionH}>Fichero subido</div>
            <div className={styles.fileList}>
              <div className={styles.fileItem}>
                <div className={styles.fileItemIcon}><FileSpreadsheet size={18} strokeWidth={1.5} /></div>
                <div className={styles.fileItemInfo}>
                  <div className={styles.fileItemName}>{ficheroAtlas.file.name}</div>
                  <div className={styles.fileItemMeta}>
                    <span className={styles.mono}>{formatBytes(ficheroAtlas.file.size)}</span> · {ficheroAtlas.rows.length} contratos detectados · <span className={styles.pillOk}>plantilla ATLAS reconocida</span>
                  </div>
                </div>
                <button type="button" className={styles.fileItemRemove} title="Quitar" onClick={() => setFicheroAtlas(null)}>
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.wizFoot}>
          <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={() => irAPaso(1)}><ArrowLeft size={14} /> Atrás</button>
          <div className={styles.wizFootInfo}>{ficheroAtlas ? `${totalContratos} contratos detectados` : 'Sube el fichero rellenado para continuar'}</div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} disabled={!puedeContinuarPaso2 || preparando} onClick={irARevision}>
            {preparando ? 'Preparando...' : 'Continuar a revisión'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={14} /> Volver a inmuebles
      </button>
      <h1 className={styles.title}>Importar contratos de alquiler</h1>
      <p className={styles.sub}>
        Sube tus contratos desde Rentila, una plantilla de ATLAS o tu propio Excel. ATLAS los revisa contigo antes de crearlos para evitar duplicados y errores.
      </p>

      {renderStepper()}

      {step === 1 && renderPaso1()}
      {step === 2 && (origen === 'rentila' ? renderPaso2Rentila() : renderPaso2Atlas())}
      {step === 3 && (
        <PasoRevision
          drafts={drafts}
          inmuebleOpciones={inmuebleOpciones}
          origen={origen}
          onCrear={crearDrafts}
          onContinuar={() => irAPaso(4)}
          onAtras={() => irAPaso(2)}
        />
      )}
      {step === 4 && (
        // Paso 4 · resumen final · se implementa en el commit 8.
        <section className={styles.stepContent}>
          <div className={styles.panel}>
            <div className={styles.panelH}>Resumen final</div>
            <div className={styles.panelSub}>En construcción · commit 8.</div>
            <div className={styles.wizFoot}>
              <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={() => irAPaso(3)}><ArrowLeft size={14} /> Volver a revisión</button>
              <div />
              <button type="button" className={cx(styles.btn, styles.btnGold)} onClick={onComplete}><ArrowRight size={14} /> Ir a Por conciliar</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ImportarContratosWizard;
