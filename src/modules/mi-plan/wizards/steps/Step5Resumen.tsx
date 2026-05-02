import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoDraft } from '../types';
import { parseMetaNumeric } from '../types';
import type { FondoAhorro } from '../../../../types/miPlan';
import type { Prestamo } from '../../../../types/prestamos';
import type { RitmoResult } from '../utils/calcularRitmo';

const fmtEur = (n: number, suf = '€'): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${suf}`;

const fmtFecha = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d
    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '');
};

const TIPO_LABEL: Record<string, string> = {
  acumular: 'Acumular',
  amortizar: 'Amortizar',
  comprar: 'Comprar',
  reducir: 'Reducir',
};

const REDUCIR_LABEL: Record<string, string> = {
  gastos_personales: 'Gastos personales',
  suministros: 'Suministros',
  suscripciones: 'Suscripciones',
  otro: 'Otro',
};

interface Props {
  draft: ObjetivoDraft;
  fondos: FondoAhorro[];
  prestamos: Prestamo[];
  saldosFondos: Record<string, number>;
  inmueblesCount: number;
  ritmo: RitmoResult;
  /** AST visual derivado · siguiente correlativo en la lista existente. */
  proximoAst: string;
}

const Step5Resumen: React.FC<Props> = ({
  draft,
  fondos,
  prestamos,
  saldosFondos,
  inmueblesCount,
  ritmo,
  proximoAst,
}) => {
  const tipo = draft.tipo;
  const fondo = fondos.find((f) => f.id === draft.fondoId);
  const prestamo = prestamos.find((p) => p.id === draft.prestamoId);

  let labelAhorrado = 'Valor actual';
  let valAhorrado = '—';
  let labelMeta = 'Valor meta';
  let valMeta = '—';
  let subAhorrado = '';
  let subMeta = `para ${fmtFecha(draft.fechaCierre)}`;
  let cardClass = styles.previewCard;

  if (tipo === 'acumular') {
    cardClass = styles.previewCard;
    const sufijo = draft.acumularUnidad === 'meses' ? 'meses' : '€';
    const actual = parseMetaNumeric(draft.acumularValorActual);
    const meta = parseMetaNumeric(draft.acumularValorMeta);
    labelAhorrado = 'Ahorrado';
    valAhorrado = fmtEur(actual, sufijo);
    valMeta = fmtEur(meta, sufijo);
    subAhorrado = fondo ? `fondo "${fondo.nombre}"` : 'sin fondo vinculado';
  } else if (tipo === 'amortizar') {
    cardClass = `${styles.previewCard} ${styles.previewCardAmortizar}`;
    labelAhorrado = 'Pendiente';
    labelMeta = 'Cancelado';
    valAhorrado = prestamo ? fmtEur(prestamo.principalVivo) : '—';
    valMeta = '0 €';
    subAhorrado = prestamo ? `préstamo "${prestamo.nombre}"` : 'sin préstamo';
  } else if (tipo === 'comprar') {
    cardClass = `${styles.previewCard} ${styles.previewCardComprar}`;
    const sufijo = draft.comprarMetric === 'unidades' ? 'inmuebles' : '€';
    const actual = draft.comprarMetric === 'unidades' ? inmueblesCount : 0;
    const meta = parseMetaNumeric(draft.comprarValorMeta);
    labelAhorrado = 'Cartera actual';
    valAhorrado = `${actual} ${sufijo}`;
    valMeta = fmtEur(meta, sufijo);
  } else if (tipo === 'reducir') {
    cardClass = `${styles.previewCard} ${styles.previewCardReducir}`;
    const meta = parseMetaNumeric(draft.reducirMetaMensual);
    labelAhorrado = 'Gasto actual';
    labelMeta = 'Meta mensual';
    valAhorrado = '—';
    valMeta = fmtEur(meta) + '/mes';
    subAhorrado = 'pendiente medir desde tus movimientos';
    subMeta = `desde ${fmtFecha(draft.fechaCierre)}`;
  }

  const showRitmo = tipo === 'acumular' || tipo === 'comprar';
  const enRutaText =
    !showRitmo
      ? '—'
      : ritmo.estado === 'ok'
        ? 'sí'
        : ritmo.estado === 'tight'
          ? 'ajustado'
          : 'no';
  const enRutaCls =
    ritmo.estado === 'ok'
      ? styles.previewFootValPos
      : ritmo.estado === 'tight'
        ? styles.previewFootValWarn
        : styles.previewFootValNeg;

  let categoriaResumen = '';
  if (tipo === 'reducir') {
    categoriaResumen =
      draft.reducirCategoria === 'otro'
        ? draft.reducirCategoriaLibre || 'libre'
        : REDUCIR_LABEL[draft.reducirCategoria] ?? '';
  }

  const calcularProgreso =
    tipo === 'acumular' || tipo === 'comprar'
      ? fondo
        ? 'sí · automático desde fondo'
        : 'parcial · valor actual manual'
      : tipo === 'amortizar'
        ? 'sí · automático desde préstamo'
        : 'parcial · medir desde categorías';

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>05</span> Confirma y crea
      </div>
      <div className={styles.stepSubText}>
        Así se va a ver tu objetivo en el listado de Mi Plan · Objetivos. Si todo encaja pulsa{' '}
        <strong>Crear objetivo</strong>.
      </div>

      <div className={cardClass}>
        <div className={styles.previewHead}>
          <div>
            <div className={styles.previewAst}>
              {proximoAst} · {tipo ? TIPO_LABEL[tipo] : ''}
            </div>
            <div className={styles.previewNom}>{draft.nombre || 'Sin título'}</div>
            {draft.descripcion && (
              <div className={styles.previewCat}>{draft.descripcion}</div>
            )}
          </div>
          <span className={styles.previewEstado}>En progreso</span>
        </div>

        <div className={styles.previewNumbers}>
          <div className={styles.previewNumBlock}>
            <div className={styles.previewNumLab}>{labelAhorrado}</div>
            <div className={styles.previewNumVal}>{valAhorrado}</div>
            {subAhorrado && <div className={styles.previewNumSub}>{subAhorrado}</div>}
          </div>
          <Icons.ArrowRight size={18} strokeWidth={2} className={styles.previewNumArrow} />
          <div className={styles.previewNumBlock}>
            <div className={styles.previewNumLab}>{labelMeta}</div>
            <div className={`${styles.previewNumVal} ${styles.previewNumValPos}`}>
              {valMeta}
            </div>
            <div className={styles.previewNumSub}>{subMeta}</div>
          </div>
        </div>

        <div className={styles.previewFoot}>
          <div className={styles.previewFootItem}>
            <span className={styles.previewFootLab}>Fecha objetivo</span>
            <span className={styles.previewFootVal}>{fmtFecha(draft.fechaCierre)}</span>
          </div>
          <div className={styles.previewFootItem}>
            <span className={styles.previewFootLab}>Ritmo necesario</span>
            <span className={styles.previewFootVal}>
              {showRitmo && ritmo.ritmoNecesarioMensual > 0
                ? `+${fmtEur(ritmo.ritmoNecesarioMensual)}/mes`
                : '—'}
            </span>
          </div>
          <div className={styles.previewFootItem}>
            <span className={styles.previewFootLab}>En ruta</span>
            <span className={`${styles.previewFootVal} ${enRutaCls}`}>{enRutaText}</span>
          </div>
        </div>
      </div>

      <div className={styles.resumenExtra}>
        <div className={styles.resumenExtraTit}>Detalles del objetivo</div>
        <div className={styles.resumenExtraList}>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Tipo</span>
            <span className={styles.resumenExtraRowVal}>
              {tipo ? TIPO_LABEL[tipo] : '—'}
            </span>
          </div>
          {(tipo === 'acumular' || tipo === 'comprar') && (
            <div className={styles.resumenExtraRow}>
              <span className={styles.resumenExtraRowLab}>Fondo vinculado</span>
              {fondo ? (
                <span className={styles.resumenExtraRowVal}>
                  {fondo.nombre} · {fmtEur(saldosFondos[fondo.id] ?? 0)}
                </span>
              ) : (
                <span
                  className={`${styles.resumenExtraRowVal} ${styles.resumenExtraRowValEmpty}`}
                >
                  no
                </span>
              )}
            </div>
          )}
          {tipo === 'amortizar' && (
            <div className={styles.resumenExtraRow}>
              <span className={styles.resumenExtraRowLab}>Préstamo vinculado</span>
              {prestamo ? (
                <span className={styles.resumenExtraRowVal}>
                  {prestamo.nombre} · {fmtEur(prestamo.principalVivo)} pendiente
                </span>
              ) : (
                <span
                  className={`${styles.resumenExtraRowVal} ${styles.resumenExtraRowValEmpty}`}
                >
                  —
                </span>
              )}
            </div>
          )}
          {tipo === 'reducir' && (
            <div className={styles.resumenExtraRow}>
              <span className={styles.resumenExtraRowLab}>Categoría</span>
              <span className={styles.resumenExtraRowVal}>
                {categoriaResumen || '—'}
              </span>
            </div>
          )}
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Fecha cierre</span>
            <span className={styles.resumenExtraRowVal}>{fmtFecha(draft.fechaCierre)}</span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>ATLAS calculará progreso</span>
            <span
              className={`${styles.resumenExtraRowVal} ${styles.resumenExtraRowValPos}`}
            >
              {calcularProgreso}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step5Resumen;
