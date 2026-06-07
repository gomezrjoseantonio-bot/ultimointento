/**
 * Importador de inmuebles por plantilla Excel (NUEVO · patrón espejo del de
 * contratos): descargar → subir → revisar → crear. La detección/parse NUNCA
 * crea nada solo · el usuario confirma en la revisión (§0.1.3).
 */
import React, { useState } from 'react';
import { Icons, UploadZone, showToastV5 } from '../../../../design-system/v5';
import {
  parseInmueblesTemplateXlsx,
  InmueblesTemplateFormatError,
  type InmuebleTemplateRow,
} from '../../../../services/inmueblesTemplateParserService';
import {
  revisarRows,
  crearInmueblesDesdeRows,
  type InmuebleRevision,
  type ResultadoInmuebles,
} from '../../../../services/inmueblesImportCreationService';
import styles from '../empezar.module.css';

type Step = 'subir' | 'revisar' | 'hecho';

interface Props {
  onCreated: (res: ResultadoInmuebles) => void;
}

const eur = (n: number) => `${n.toLocaleString('es-ES')} €`;

const ImportarInmueblesWizard: React.FC<Props> = ({ onCreated }) => {
  const [step, setStep] = useState<Step>('subir');
  const [revisiones, setRevisiones] = useState<InmuebleRevision[]>([]);
  const [creando, setCreando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoInmuebles | null>(null);

  const descargarPlantilla = () => {
    const base = process.env.PUBLIC_URL ?? '';
    const a = document.createElement('a');
    a.href = `${base}/templates/plantilla-inmuebles-atlas.xlsx`;
    a.download = 'plantilla-inmuebles-atlas.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const rows: InmuebleTemplateRow[] = await parseInmueblesTemplateXlsx(file);
      if (!rows.length) {
        showToastV5('La plantilla no tiene filas con datos', 'warn');
        return;
      }
      setRevisiones(revisarRows(rows));
      setStep('revisar');
    } catch (e) {
      const msg = e instanceof InmueblesTemplateFormatError ? e.message : 'No se pudo leer el fichero';
      showToastV5(msg, 'error');
    }
  };

  const crear = async () => {
    setCreando(true);
    try {
      const rows = revisiones.filter((r) => r.valido).map((r) => r.row);
      const res = await crearInmueblesDesdeRows(rows);
      setResultado(res);
      setStep('hecho');
      showToastV5(`${res.creados} inmueble(s) creados`, 'success');
      onCreated(res);
    } catch {
      showToastV5('No se pudieron crear los inmuebles', 'error');
    } finally {
      setCreando(false);
    }
  };

  if (step === 'subir') {
    return (
      <div style={{ marginTop: 16 }}>
        <button type="button" className={styles.btnGhost} onClick={descargarPlantilla} style={{ marginBottom: 12 }}>
          <Icons.Download size={14} strokeWidth={2} /> Descargar plantilla-inmuebles-atlas.xlsx
        </button>
        <UploadZone
          accept=".xlsx"
          title="Suelta la plantilla rellena o haz clic para subir"
          sub="Una fila por inmueble · revisión antes de crear nada"
          onFiles={onFiles}
        />
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
          <div key={i} className={`${styles.sugRow} ${rev.avisos.length ? styles.needs : ''}`}>
            <div className={styles.sugConcept}>
              <div className={styles.sugName}>{rev.row.alias || '(sin alias)'}</div>
              <div className={styles.sugMeta}>
                {rev.valido
                  ? `${rev.row.modoExplotacion === 'por_habitaciones' ? 'Por habitaciones' : 'Piso completo'}${rev.avisos.length ? ' · ' + rev.avisos.join(' · ') : ''}`
                  : `No se creará · ${rev.motivo}`}
              </div>
            </div>
            <div className={`${styles.sugAmount} ${styles.mono}`}>{eur(rev.row.precioCompra)}</div>
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
          <button type="button" className={styles.btnGold} onClick={crear} disabled={creando || validas === 0}>
            {creando ? 'Creando…' : `Crear ${validas} inmueble(s)`}
            <Icons.ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // hecho
  return (
    <div style={{ marginTop: 16 }}>
      <div className={styles.sugEmptyNote}>
        <strong>{resultado?.creados ?? 0} inmueble(s) creados.</strong>
        {resultado && resultado.saltados > 0 ? ` · ${resultado.saltados} ya existían` : ''}
        {resultado && resultado.errores.length > 0 ? ` · ${resultado.errores.length} con error` : ''}
        {resultado && resultado.avisos.length > 0 && (
          <ul className={styles.honestyList} style={{ marginTop: 8 }}>
            {resultado.avisos.map((a, i) => (
              <li key={i}>
                <Icons.Warning size={12} strokeWidth={2.5} /> {a.alias} · {a.aviso}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ImportarInmueblesWizard;
