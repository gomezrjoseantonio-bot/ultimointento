// Mi Plan → Hitos vitales · CRUD básico de `objetivosVitales`.
// T-INVERSIONES-DETALLE-PP-v1 · PR 3 · §4.C Caso B.
//
// Pestaña dentro de Mi Plan · convive con la pestaña "Objetivos" (operativos)
// sin solaparse. Los hitos vitales son eventos de vida con fecha · usados
// por BloqueHitos en la ficha de inversiones (PR 4).

import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmptyState, Icons, Pill, showToastV5 } from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';
import type { ObjetivoVital, TipoObjetivoVital } from '../../../types/objetivosVitales';
import {
  createObjetivoVital,
  deleteObjetivoVital,
  updateObjetivoVital,
} from '../../../services/objetivosVitalesService';
import {
  resolveSupuestosProyeccion,
  saveEscenarioActivo,
  saveSupuestosProyeccion,
} from '../../../services/escenariosService';
import styles from './HitosVitalesPage.module.css';

const TIPO_LABEL: Record<TipoObjetivoVital, string> = {
  jubilacion: 'Jubilación',
  salida_empresa: 'Salida de empresa',
  compra_vivienda: 'Compra vivienda',
  hijo_universidad: 'Hijo a universidad',
  herencia: 'Herencia',
  otro: 'Otro',
};

const TIPO_OPTIONS: TipoObjetivoVital[] = [
  'jubilacion',
  'salida_empresa',
  'compra_vivienda',
  'hijo_universidad',
  'herencia',
  'otro',
];

interface EditState {
  id: string | null; // null = creando · string = editando
  nombre: string;
  fechaEstimada: string;
  descripcion: string;
  tipo: TipoObjetivoVital;
}

const EMPTY_FORM: EditState = {
  id: null,
  nombre: '',
  fechaEstimada: '',
  descripcion: '',
  tipo: 'jubilacion',
};

const HitosVitalesPage = () => {
  const { hitosVitales, escenario, reload } = useOutletContext<MiPlanOutletContext>();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<EditState>(EMPTY_FORM);
  const [working, setWorking] = useState(false);

  // Supuestos de proyección · edad rescate + inflación (§4.B).
  // Inflación desde la fuente única (C-PROY-5 · B1).
  const [edadRescate, setEdadRescate] = useState<number>(escenario?.edadObjetivoRescate ?? 65);
  const [inflacion, setInflacion] = useState<number>(
    escenario ? resolveSupuestosProyeccion(escenario).inflacionGastosPct : 2.5,
  );

  useEffect(() => {
    if (escenario) {
      setEdadRescate(escenario.edadObjetivoRescate ?? 65);
      setInflacion(resolveSupuestosProyeccion(escenario).inflacionGastosPct);
    }
  }, [escenario]);

  const guardarSupuestos = async () => {
    if (edadRescate < 55 || edadRescate > 75) {
      showToastV5('Edad de rescate debe estar entre 55 y 75', 'error');
      return;
    }
    if (inflacion < 0 || inflacion > 15) {
      showToastV5('Inflación debe estar entre 0 % y 15 %', 'error');
      return;
    }
    try {
      await saveEscenarioActivo({ edadObjetivoRescate: edadRescate });
      await saveSupuestosProyeccion({ inflacionGastosPct: inflacion });
      showToastV5('Supuestos guardados', 'success');
      reload();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  useEffect(() => {
    if (!formVisible) setForm(EMPTY_FORM);
  }, [formVisible]);

  const abrirCrear = useCallback(() => {
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const abrirEditar = useCallback((h: ObjetivoVital) => {
    setForm({
      id: h.id,
      nombre: h.nombre,
      fechaEstimada: h.fechaEstimada,
      descripcion: h.descripcion ?? '',
      tipo: h.tipo,
    });
    setFormVisible(true);
  }, []);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.fechaEstimada) {
      showToastV5('Nombre y fecha son obligatorios', 'error');
      return;
    }
    setWorking(true);
    try {
      if (form.id) {
        await updateObjetivoVital(form.id, {
          nombre: form.nombre,
          fechaEstimada: form.fechaEstimada,
          descripcion: form.descripcion,
          tipo: form.tipo,
        });
        showToastV5('Hito vital actualizado', 'success');
      } else {
        await createObjetivoVital({
          nombre: form.nombre,
          fechaEstimada: form.fechaEstimada,
          descripcion: form.descripcion || undefined,
          tipo: form.tipo,
        });
        showToastV5('Hito vital creado', 'success');
      }
      setFormVisible(false);
      reload();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    } finally {
      setWorking(false);
    }
  };

  const eliminar = async (h: ObjetivoVital) => {
    if (!window.confirm(`¿Eliminar "${h.nombre}"?`)) return;
    try {
      await deleteObjetivoVital(h.id);
      showToastV5('Hito vital eliminado', 'success');
      reload();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      {/* ── Supuestos de proyección · §4.B ────────────────────────────── */}
      <section className={styles.supuestos} aria-label="Supuestos de proyección">
        <div className={styles.supuestosHead}>
          <div>
            <h3 className={styles.supuestosTitle}>Supuestos de proyección</h3>
            <div className={styles.supuestosSub}>
              edad de rescate e inflación · usados por la proyección en la ficha de cada inversión
            </div>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            onClick={guardarSupuestos}
          >
            <Icons.Check size={14} strokeWidth={1.8} />
            Guardar supuestos
          </button>
        </div>
        <div className={styles.supuestosGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="edad-rescate">
              Edad objetivo de rescate
            </label>
            <div className={styles.sliderRow}>
              <input
                id="edad-rescate"
                type="range"
                min={55}
                max={75}
                step={1}
                value={edadRescate}
                onChange={(e) => setEdadRescate(Number(e.target.value))}
                className={styles.slider}
                aria-label="Edad objetivo de rescate"
              />
              <span className={styles.sliderValue}>{edadRescate} años</span>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="inflacion-anual">
              Inflación anual asumida
            </label>
            <div className={styles.sliderRow}>
              <input
                id="inflacion-anual"
                type="number"
                step="0.1"
                min={0}
                max={15}
                value={inflacion}
                onChange={(e) => setInflacion(Number(e.target.value))}
                className={styles.input}
                style={{ maxWidth: 100 }}
                aria-label="Inflación anual asumida en porcentaje"
              />
              <span className={styles.sliderValue}>%</span>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Hitos vitales</h2>
          <div className={styles.sub}>
            eventos vitales con fecha · jubilación · salida empresa · compra vivienda · hijo a uni
            · alimentan la ficha de inversiones (timeline hasta rescate)
          </div>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGold}`}
          onClick={abrirCrear}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Añadir hito vital
        </button>
      </div>

      {formVisible && (
        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="hito-nombre">Nombre</label>
              <input
                id="hito-nombre"
                className={styles.input}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Salida de Orange España"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="hito-tipo">Tipo</label>
              <select
                id="hito-tipo"
                className={styles.input}
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoObjetivoVital }))}
              >
                {TIPO_OPTIONS.map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="hito-fecha">Fecha estimada</label>
              <input
                id="hito-fecha"
                className={styles.input}
                type="date"
                value={form.fechaEstimada}
                onChange={(e) => setForm((f) => ({ ...f, fechaEstimada: e.target.value }))}
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.fieldLabel} htmlFor="hito-desc">Descripción (opcional)</label>
              <input
                id="hito-desc"
                className={styles.input}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Notas adicionales"
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setFormVisible(false)}
              disabled={working}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGold}`}
              onClick={guardar}
              disabled={working}
            >
              <Icons.Check size={14} strokeWidth={1.8} />
              {form.id ? 'Guardar cambios' : 'Crear hito'}
            </button>
          </div>
        </div>
      )}

      {hitosVitales.length === 0 ? (
        <EmptyState
          title="Sin hitos vitales"
          description="Añade eventos clave de tu vida con fecha · jubilación · salida empresa · etc. Los hitos vitales se usan en la ficha de cada inversión para mostrar la timeline hasta el rescate."
        />
      ) : (
        <div className={styles.list}>
          {hitosVitales.map((h) => {
            const pasado = h.fechaEstimada < hoy;
            return (
              <div key={h.id} className={`${styles.card} ${pasado ? styles.cardPasado : ''}`}>
                <div className={styles.cardHead}>
                  <div className={styles.cardTitle}>{h.nombre}</div>
                  <Pill variant={pasado ? 'gris' : 'gold'}>
                    {TIPO_LABEL[h.tipo]}
                  </Pill>
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardFecha}>{h.fechaEstimada}</span>
                  {h.planFinancieroAsociado && (
                    <span className={styles.cardChip}>asociado a posición</span>
                  )}
                </div>
                {h.descripcion && <div className={styles.cardDesc}>{h.descripcion}</div>}
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => abrirEditar(h)}
                  >
                    <Icons.Edit size={13} strokeWidth={1.8} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => eliminar(h)}
                  >
                    <Icons.Delete size={13} strokeWidth={1.8} />
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HitosVitalesPage;
