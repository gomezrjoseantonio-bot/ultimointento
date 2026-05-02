import React from 'react';
import styles from '../WizardNuevoFondo.module.css';
import type { FondoDraft, CategoriaFondo } from '../typesFondo';
import { calcularMetaColchon, parseImporte, labelCategoria, buildFechaIso } from '../typesFondo';
import type { Objetivo } from '../../../../types/miPlan';
import type { RitmoResult } from '../utils/calcularRitmo';

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

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

const COLOR_BY_CATEGORIA: Record<
  CategoriaFondo,
  { dot: string; nombre: string }
> = {
  colchon: { dot: 'var(--atlas-v5-gold)', nombre: 'oro' },
  compra: { dot: 'var(--atlas-v5-brand)', nombre: 'navy' },
  reforma: { dot: 'var(--atlas-v5-pos)', nombre: 'verde' },
  impuestos: { dot: 'var(--atlas-v5-brand-2)', nombre: 'navy claro' },
};

interface Props {
  draft: FondoDraft;
  objetivos: Objetivo[];
  asignadoTotal: number;
  acumuladoEstimado: number;
  ritmo: RitmoResult;
}

const AsideResumenFondo: React.FC<Props> = ({
  draft,
  objetivos,
  asignadoTotal,
  acumuladoEstimado,
  ritmo,
}) => {
  const cat = draft.categoria;
  const meta = cat === 'colchon' ? calcularMetaColchon(draft) : parseImporte(draft.metaImporte);
  const progresoPct = meta > 0 ? Math.min(100, (acumuladoEstimado / meta) * 100) : 0;
  const fechaIso = buildFechaIso(draft.fechaObjetivoMes, draft.fechaObjetivoAnio);

  const objetivoVinculado = draft.objetivoVinculadoId
    ? objetivos.find((o) => o.id === draft.objetivoVinculadoId)
    : undefined;

  const tituloAside = draft.nombre
    ? truncate(draft.nombre, 40)
    : cat
      ? `Nuevo fondo · ${labelCategoria(cat)}`
      : 'Nuevo fondo';

  const renderVal = (
    v: string | number | null,
    mono = false,
  ): React.ReactElement => {
    if (v == null || v === '' || v === 0) {
      return <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>;
    }
    const cls = mono
      ? `${styles.asideRowVal} ${styles.asideRowValMono}`
      : styles.asideRowVal;
    return <span className={cls}>{v}</span>;
  };

  const colorTarjeta = cat ? COLOR_BY_CATEGORIA[cat] : null;
  const cuentasSel = draft.cuentasAsignadas.length;
  const capacidad = parseImporte(draft.capacidadAhorroMensual);

  return (
    <aside className={styles.aside} aria-label="Resumen vivo del fondo">
      <div className={styles.asideLabel}>Resumen</div>
      <div className={styles.asideTitle}>{tituloAside}</div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Categoría</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Tipo</span>
          {cat ? (
            <span className={styles.asideRowVal}>{labelCategoria(cat)}</span>
          ) : (
            <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>
          )}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Color tarjeta</span>
          {colorTarjeta ? (
            <span className={styles.asideRowVal}>
              <span
                className={styles.asideColorDot}
                style={{ background: colorTarjeta.dot }}
                aria-hidden
              />
              {colorTarjeta.nombre}
            </span>
          ) : (
            <span className={`${styles.asideRowVal} ${styles.asideRowValEmpty}`}>—</span>
          )}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Meta</div>
        {cat === 'colchon' ? (
          <>
            <div className={styles.asideRow}>
              <span className={styles.asideRowLab}>Meses cubiertos</span>
              {parseImporte(draft.colchonMeses) > 0
                ? renderVal(`${draft.colchonMeses} meses`, true)
                : renderVal('')}
            </div>
            <div className={styles.asideRow}>
              <span className={styles.asideRowLab}>Gasto mensual</span>
              {parseImporte(draft.colchonGastoMensual) > 0
                ? renderVal(fmtEur(parseImporte(draft.colchonGastoMensual)), true)
                : renderVal('')}
            </div>
            <div className={styles.asideRow}>
              <span className={styles.asideRowLab}>Meta total</span>
              {meta > 0 ? renderVal(fmtEur(meta), true) : renderVal('')}
            </div>
          </>
        ) : (
          <div className={styles.asideRow}>
            <span className={styles.asideRowLab}>Importe</span>
            {meta > 0 ? renderVal(fmtEur(meta), true) : renderVal('')}
          </div>
        )}
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Fecha</span>
          {renderVal(fmtFecha(fechaIso))}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Cuentas origen</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Seleccionadas</span>
          {cuentasSel > 0
            ? renderVal(String(cuentasSel))
            : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Asignado total</span>
          {asignadoTotal > 0 ? renderVal(fmtEur(asignadoTotal), true) : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Progreso inicial</span>
          {meta > 0 && acumuladoEstimado > 0
            ? renderVal(`${Math.round(progresoPct)}%`, true)
            : renderVal('')}
        </div>
      </div>

      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Vínculos</div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Objetivo</span>
          {objetivoVinculado
            ? renderVal(truncate(objetivoVinculado.nombre, 22))
            : draft.vinculoElegido
              ? renderVal('sin vincular')
              : renderVal('')}
        </div>
        <div className={styles.asideRow}>
          <span className={styles.asideRowLab}>Tipo objetivo</span>
          {objetivoVinculado
            ? renderVal(objetivoVinculado.tipo)
            : renderVal('')}
        </div>
      </div>

      {ritmo.ritmoNecesarioMensual > 0 && (
        <div className={styles.asideProgress}>
          <div className={styles.asideProgLab}>Ritmo necesario</div>
          <div className={styles.asideProgVal}>
            +{fmtEur(ritmo.ritmoNecesarioMensual)}/mes
          </div>
          <div className={styles.asideProgText}>
            {capacidad > 0 ? (
              <>
                tu ahorro mensual indicado{' '}
                <strong>{fmtEur(capacidad)}/mes</strong>
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
              'indica tu capacidad de ahorro mensual estimada en el paso 3'
            )}
          </div>
        </div>
      )}

      <div className={styles.asideStatus}>
        Este fondo se creará en estado <strong>activo</strong>. ATLAS recalculará el progreso
        y el ritmo automáticamente cada vez que cambien los saldos de las cuentas vinculadas.
      </div>
    </aside>
  );
};

export default AsideResumenFondo;
