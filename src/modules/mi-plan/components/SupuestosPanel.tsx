// SupuestosPanel · C-PROY-5 · Fase B5
//
// Los mandos de la curva, DENTRO de Mi Plan (no en Ajustes ni en pantalla
// aparte). Componente controlado: el estado vive en ProyeccionPage, que
// persiste en la fuente única B1 (Escenario.supuestos) y refresca curva y
// año de libertad — la consecuencia siempre visible.
//
// Estructura de la spec: tres supuestos de impacto arriba · vacancia, ahorro
// y salario en segundo plano (plegados) · sobrescritura por compromiso de la
// inflación plegada por defecto · nota fiscal honesta obligatoria.

import React from 'react';
import type { SupuestosProyeccion } from '../../../types/supuestosProyeccion';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../types/supuestosProyeccion';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import styles from './SupuestosPanel.module.css';

export interface SupuestosPanelProps {
  valores: SupuestosProyeccion;
  onCambio: (campo: keyof SupuestosProyeccion, valor: number) => void;
  /** Compromisos de inmueble activos · para la sección de sobrescritura. */
  compromisos: CompromisoRecurrente[];
}

interface SliderDef {
  campo: keyof SupuestosProyeccion;
  label: string;
  min: number;
  max: number;
  step: number;
}

const PRIMARIOS: SliderDef[] = [
  { campo: 'revalorizacionInmueblesPct', label: 'Revalorización de inmuebles', min: 0, max: 12, step: 0.1 },
  { campo: 'subidaRentasPct', label: 'Subida de rentas', min: 0, max: 10, step: 0.1 },
  { campo: 'inflacionGastosPct', label: 'Inflación de gastos', min: 0, max: 8, step: 0.1 },
];

const SECUNDARIOS: SliderDef[] = [
  { campo: 'vacanciaPct', label: 'Vacancia', min: 0, max: 20, step: 0.5 },
  { campo: 'rentabilidadAhorroPct', label: 'Rentabilidad del ahorro', min: 0, max: 10, step: 0.1 },
  { campo: 'subidaNominaPct', label: 'Subida de nómina', min: 0, max: 10, step: 0.1 },
  { campo: 'subidaAutonomoPct', label: 'Subida ingresos autónomo', min: 0, max: 10, step: 0.1 },
];

const fmtPct = (v: number): string =>
  `${v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function etiquetaVariacion(c: CompromisoRecurrente): string | null {
  if (!c.variacion) return null;
  switch (c.variacion.tipo) {
    case 'ipcAnual':
      return `IPC anual${c.variacion.ultimoIpcAplicado != null ? ` · ${(c.variacion.ultimoIpcAplicado * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : ''}`;
    case 'aniversarioContrato':
      return `+${c.variacion.porcentajeAnual.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %/año (aniversario)`;
    case 'sinVariacion':
      return 'sin variación (fijado)';
    case 'manual':
      return 'manual';
    default:
      return null;
  }
}

const Mando: React.FC<{
  def: SliderDef;
  valor: number;
  onCambio: SupuestosPanelProps['onCambio'];
}> = ({ def, valor, onCambio }) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel} htmlFor={`supuesto-${def.campo}`}>
      {def.label}
    </label>
    <div className={styles.fieldDefault}>
      por defecto {fmtPct(SUPUESTOS_PROYECCION_DEFAULTS[def.campo])}
    </div>
    <div className={styles.sliderRow}>
      <input
        id={`supuesto-${def.campo}`}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={valor}
        onChange={(e) => onCambio(def.campo, Number(e.target.value))}
        className={styles.slider}
        aria-label={`${def.label} · por defecto ${fmtPct(SUPUESTOS_PROYECCION_DEFAULTS[def.campo])}`}
      />
      <span className={`${styles.sliderValue} mono`}>{fmtPct(valor)}</span>
    </div>
  </div>
);

const SupuestosPanel: React.FC<SupuestosPanelProps> = ({ valores, onCambio, compromisos }) => {
  const conOverride = compromisos
    .map((c) => ({ c, etiqueta: etiquetaVariacion(c) }))
    .filter((x): x is { c: CompromisoRecurrente; etiqueta: string } => x.etiqueta !== null);

  return (
    <div>
      {/* Tres supuestos de impacto · arriba */}
      <div className={styles.grid}>
        {PRIMARIOS.map((def) => (
          <Mando key={def.campo} def={def} valor={valores[def.campo]} onCambio={onCambio} />
        ))}
      </div>

      {/* Vacancia · ahorro · salario · segundo plano */}
      <details className={styles.detalle}>
        <summary className={styles.detalleSummary}>Más supuestos · vacancia, ahorro y salario</summary>
        <div className={`${styles.detalleBody} ${styles.grid}`}>
          {SECUNDARIOS.map((def) => (
            <Mando key={def.campo} def={def} valor={valores[def.campo]} onCambio={onCambio} />
          ))}
        </div>
      </details>

      {/* Sobrescritura por compromiso · plegada por defecto */}
      <details className={styles.detalle}>
        <summary className={styles.detalleSummary}>
          Sobrescritura por gasto recurrente · inflación
        </summary>
        <div className={styles.detalleBody}>
          {conOverride.length > 0 ? (
            <>
              <ul className={styles.overrideLista}>
                {conOverride.map(({ c, etiqueta }) => (
                  <li key={c.id} className={styles.overrideItem}>
                    <span>{c.alias}</span>
                    <span className={styles.overrideEtiqueta}>{etiqueta}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.overrideVacio} style={{ marginTop: 8 }}>
                Estos gastos siguen su propia variación en vez de la inflación global · se cambia en
                la ficha de cada gasto recurrente.
              </p>
            </>
          ) : (
            <p className={styles.overrideVacio}>
              Ningún gasto recurrente sobrescribe la inflación global. La variación propia (IPC ·
              % por aniversario · fijado) se define en la ficha de cada gasto recurrente de
              inmueble.
            </p>
          )}
        </div>
      </details>

      {/* Nota honesta obligatoria */}
      <div className={styles.notaFiscal} role="note">
        Ningún supuesto fiscal a futuro está incluido todavía · el IRPF proyectado usa tus datos
        actuales y los contratos simulados, sin amortizaciones ni plusvalías futuras.
      </div>
    </div>
  );
};

export default SupuestosPanel;
