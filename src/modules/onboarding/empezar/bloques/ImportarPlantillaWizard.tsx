/**
 * Wizard genérico de importación por plantilla Excel (inmuebles · préstamos ·
 * inversiones). Patrón único: descargar → subir → revisar → crear. La detección
 * NUNCA crea sola · el usuario confirma en la revisión (§0.1.3).
 */
import React, { useState } from 'react';
import { Icons, UploadZone, showToastV5 } from '../../../../design-system/v5';
import styles from '../empezar.module.css';

export interface PlantillaRevisionView {
  label: string;
  sub: string;
  amount?: number;
  valido: boolean;
}

export interface PlantillaResultadoView {
  creados: number;
  resumen: string;
  avisos?: string[];
}

interface Props<Row> {
  templateFilename: string;
  uploadSub: string;
  parse: (file: File) => Promise<Row[]>;
  revisar: (rows: Row[]) => Promise<PlantillaRevisionView[]> | PlantillaRevisionView[];
  crear: (rows: Row[]) => Promise<PlantillaResultadoView>;
  formatError: (e: unknown) => string;
  onCreated: () => void;
  /** Etiqueta del botón crear · "inmueble(s)", "préstamo(s)", "posición(es)". */
  entidad: string;
}

const eur = (n: number) => `${n.toLocaleString('es-ES')} €`;

function ImportarPlantillaWizard<Row>({
  templateFilename,
  uploadSub,
  parse,
  revisar,
  crear,
  formatError,
  onCreated,
  entidad,
}: Props<Row>) {
  const [step, setStep] = useState<'subir' | 'revisar' | 'hecho'>('subir');
  const [rows, setRows] = useState<Row[]>([]);
  const [revisiones, setRevisiones] = useState<PlantillaRevisionView[]>([]);
  const [creando, setCreando] = useState(false);
  const [resultado, setResultado] = useState<PlantillaResultadoView | null>(null);

  const descargar = () => {
    const base = process.env.PUBLIC_URL ?? '';
    const a = document.createElement('a');
    a.href = `${base}/templates/${templateFilename}`;
    a.download = templateFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const parsed = await parse(file);
      if (!parsed.length) {
        showToastV5('La plantilla no tiene filas con datos', 'warn');
        return;
      }
      setRows(parsed);
      setRevisiones(await revisar(parsed));
      setStep('revisar');
    } catch (e) {
      showToastV5(formatError(e), 'error');
    }
  };

  const crearTodo = async () => {
    setCreando(true);
    try {
      const res = await crear(rows);
      setResultado(res);
      setStep('hecho');
      showToastV5(`${res.creados} ${entidad} creados`, 'success');
      onCreated();
    } catch {
      showToastV5(`No se pudieron crear los ${entidad}`, 'error');
    } finally {
      setCreando(false);
    }
  };

  if (step === 'subir') {
    return (
      <div style={{ marginTop: 16 }}>
        <button type="button" className={styles.btnGhost} onClick={descargar} style={{ marginBottom: 12 }}>
          <Icons.Download size={14} strokeWidth={2} /> Descargar {templateFilename}
        </button>
        <UploadZone accept=".xlsx" title="Suelta la plantilla rellena o haz clic para subir" sub={uploadSub} onFiles={onFiles} />
      </div>
    );
  }

  if (step === 'revisar') {
    const validas = revisiones.filter((r) => r.valido).length;
    return (
      <div style={{ marginTop: 16 }}>
        <div className={styles.sugGroupTitle}>
          Revisión · {validas} de {revisiones.length} filas válidas
        </div>
        {revisiones.map((rev, i) => (
          <div key={i} className={styles.sugRow}>
            <div className={styles.sugConcept}>
              <div className={styles.sugName}>{rev.label}</div>
              <div className={styles.sugMeta}>{rev.sub}</div>
            </div>
            <div className={`${styles.sugAmount} ${styles.mono}`}>{rev.amount != null ? eur(rev.amount) : ''}</div>
            <div className={styles.sugPeriod}>
              {rev.valido ? <Icons.Success size={16} strokeWidth={2} /> : <Icons.Warning size={16} strokeWidth={2} />}
            </div>
            <div />
          </div>
        ))}
        <div className={styles.stepNav}>
          <button type="button" className={styles.btnGhost} onClick={() => setStep('subir')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Cambiar fichero
          </button>
          <button type="button" className={styles.btnGold} onClick={crearTodo} disabled={creando || validas === 0}>
            {creando ? 'Creando…' : `Crear ${validas} ${entidad}`}
            <Icons.ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className={styles.sugEmptyNote}>
        <strong>{resultado?.resumen}</strong>
        {resultado?.avisos && resultado.avisos.length > 0 && (
          <ul className={styles.honestyList} style={{ marginTop: 8 }}>
            {resultado.avisos.map((a, i) => (
              <li key={i}>
                <Icons.Warning size={12} strokeWidth={2.5} /> {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ImportarPlantillaWizard;
