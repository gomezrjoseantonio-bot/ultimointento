import React from 'react';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoDraft } from '../types';
import { parseMetaNumeric } from '../types';
import type { FondoAhorro } from '../../../../types/miPlan';
import type { Prestamo } from '../../../../types/prestamos';
import type { RitmoResult } from '../utils/calcularRitmo';

interface Props {
  draft: ObjetivoDraft;
  fondos: FondoAhorro[];
  prestamos: Prestamo[];
  inmueblesCount: number;
  ritmo: RitmoResult;
}

const TIPO_LABEL: Record<string, string> = {
  acumular: 'Acumular',
  amortizar: 'Amortizar',
  comprar: 'Comprar',
  reducir: 'Reducir',
};

const TIPO_COLOR: Record<string, { dot: string; nombre: string }> = {
  acumular: { dot: 'var(--atlas-v5-gold-soft)', nombre: 'oro suave' },
  amortizar: { dot: 'var(--atlas-v5-brand)', nombre: 'navy' },
  comprar: { dot: 'var(--atlas-v5-gold)', nombre: 'oro' },
  reducir: { dot: 'var(--atlas-v5-ink-3)', nombre: 'gris' },
};

const fmtEur = (n: number, suffix = '€'): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${suffix}`;

const fmtFecha = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d
    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '');
};

const truncate = (s: string, max = 28): string =>
  s.length > max ? s.slice(0, max - 1) + '…' : s;

interface MetaResolved {
  meta: number;
  actual: number;
  unidad: string; // sufijo · "€" / "meses" / "inmuebles" / "€/mes"
  fondoLabel?: string;
  prestamoLabel?: string;
}

const resolveMeta = (
  draft: ObjetivoDraft,
  fondos: FondoAhorro[],
  prestamos: Prestamo[],
  inmueblesCount: number,
): MetaResolved => {
  const fondo = fondos.find((f) => f.id === draft.fondoId);
  const fondoLabel = fondo?.nombre;

  if (draft.tipo === 'acumular') {
    return {
      meta: parseMetaNumeric(draft.acumularValorMeta),
      actual: parseMetaNumeric(draft.acumularValorActual),
      unidad: draft.acumularUnidad === 'meses' ? 'meses' : '€',
      fondoLabel,
    };
  }
  if (draft.tipo === 'amortizar') {
    const prestamo = prestamos.find((p) => p.id === draft.prestamoId);
    return {
      meta: 0,
      actual: prestamo?.principalVivo ?? 0,
      unidad: '€',
      prestamoLabel: prestamo?.nombre,
    };
  }
  if (draft.tipo === 'comprar') {
    return {
      meta: parseMetaNumeric(draft.comprarValorMeta),
      actual: draft.comprarMetric === 'unidades' ? inmueblesCount : 0,
      unidad: draft.comprarMetric === 'unidades' ? 'inmuebles' : '€',
      fondoLabel,
    };
  }
  if (draft.tipo === 'reducir') {
    return {
      meta: parseMetaNumeric(draft.reducirMetaMensual),
      actual: 0,
      unidad: '€/mes',
    };
  }
  return { meta: 0, actual: 0, unidad: '€' };
};

const AsideResumen: React.FC<Props> = ({ draft, fondos, prestamos, inmueblesCount, ritmo }) => {
  const meta = resolveMeta(draft, fondos, prestamos, inmueblesCount);
  const falta = Math.max(0, meta.meta - meta.actual);
  const tipoLabel = draft.tipo ? TIPO_LABEL[draft.tipo] : '';
  const tipoColor = draft.tipo ? TIPO_COLOR[draft.tipo] : null;

  const tituloAside = draft.nombre
    ? truncate(draft.nombre, 40)
    : draft.tipo
      ? `Nuevo objetivo · ${tipoLabel}`
      : 'Nuevo objetivo';

  const renderVal = (v: string | number | null, mono = false): React.ReactElement => {
    if (v == null || v === '' || v === 0) {
      return <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>;
    }
    const cls = mono
      ? `${styles.asideRowVal} ${styles.asideRowValMono}`
      : styles.asideRowVal;
    return <span className={cls}>{v}</span>;
  };

  const fondo = fondos.find((f) => f.id === draft.fondoId);
  const prestamo = prestamos.find((p) => p.id === draft.prestamoId);

  return (
    <aside className={styles.aside} aria-label="Resumen vivo del objetivo">
      <div className={styles.asideLabel}>Resumen</div>
      <div className={styles.asideTitle}>{tituloAside}</div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Tipo</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Categoría</span>
          {tipoLabel ? (
            <span className={styles.asideRowVal}>{tipoLabel}</span>
          ) : (
            <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>
          )}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Color tarjeta</span>
          {tipoColor ? (
            <span className={styles.asideRowVal}>
              <span
                className={styles.asideColorDot}
                style={{ background: tipoColor.dot }}
                aria-hidden
              />
              {tipoColor.nombre}
            </span>
          ) : (
            <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>
          )}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Meta</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Nombre</span>
          {renderVal(draft.nombre ? truncate(draft.nombre, 24) : '')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Valor meta</span>
          {meta.meta > 0 ? renderVal(fmtEur(meta.meta, meta.unidad), true) : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Valor actual</span>
          {meta.actual > 0 || draft.tipo === 'amortizar'
            ? renderVal(fmtEur(meta.actual, meta.unidad), true)
            : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Falta</span>
          {falta > 0 ? renderVal(fmtEur(falta, meta.unidad), true) : renderVal('')}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Plazo</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Fecha</span>
          {renderVal(fmtFecha(draft.fechaCierre))}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Meses restantes</span>
          {ritmo.mesesRestantes > 0
            ? renderVal(`${ritmo.mesesRestantes} meses`, true)
            : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Ritmo necesario</span>
          {ritmo.ritmoNecesarioMensual > 0
            ? renderVal(`+${fmtEur(ritmo.ritmoNecesarioMensual)}/mes`, true)
            : renderVal('')}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Vínculos</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Fondo</span>
          {fondo
            ? renderVal(truncate(fondo.nombre, 22))
            : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Préstamo</span>
          {prestamo
            ? renderVal(truncate(prestamo.nombre, 22))
            : renderVal('')}
        </div>
      </div>

      {ritmo.ritmoNecesarioMensual > 0 && (
        <div className={styles.asideProgress}>
          <div className={styles.asideProgLab}>En ruta</div>
          <div className={styles.asideProgVal}>
            +{fmtEur(ritmo.ritmoNecesarioMensual)}/mes
          </div>
          <div className={styles.asideProgText}>
            {parseMetaNumeric(draft.capacidadAhorroMensual) > 0 ? (
              <>
                tu capacidad indicada{' '}
                <strong>{fmtEur(parseMetaNumeric(draft.capacidadAhorroMensual))}/mes</strong>
                {' · margen '}
                <span
                  className={
                    ritmo.margen >= 0 ? styles.asideMargenPos : styles.asideMargenNeg
                  }
                >
                  {ritmo.margen >= 0 ? '+' : ''}
                  {fmtEur(ritmo.margen)}
                </span>
              </>
            ) : (
              'indica tu capacidad de ahorro mensual estimada en el paso 3 para validar la ruta'
            )}
          </div>
        </div>
      )}

      <div className={styles.asideStatus}>
        Este objetivo se creará en estado <strong>en progreso</strong>. ATLAS recalculará el
        ritmo y la ruta automáticamente cada mes.
      </div>
    </aside>
  );
};

export default AsideResumen;
