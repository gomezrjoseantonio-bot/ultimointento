import React, { useMemo } from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './ComposicionPatrimonioNeto.module.css';

export interface ComposicionPatrimonioNetoProps {
  /** Coste total de adquisición · precio + gastos + impuestos. */
  costeAdquisicion: number;
  /** Valor actual · última valoración · `null` si no hay ninguna. */
  valorActual: number | null;
  /** Deuda pendiente total imputada al inmueble. */
  deudaPendiente: number;
  /** Patrimonio neto · (valorActual ?? costeAdquisicion) − deudaPendiente. */
  patrimonioNeto: number;
  /** Revalorización · valorActual − costeAdquisicion · `null` sin valoración. */
  revalorizacion: number | null;
  /** Suma del principal inicial imputado de toda la financiación del inmueble. */
  principalInicialTotal: number;
}

type Tono = 'cash' | 'amortizada' | 'revalorizacion' | 'deudaPendiente';

interface Segmento {
  key: Tono;
  label: string;
  amount: number;
}

export interface ComposicionModelo {
  segmentos: Segmento[];
  /** Valor total sobre el que se reparte la barra (neto + deuda pendiente). */
  valorTotal: number;
  patrimonioNeto: number;
  /** Peso del patrimonio neto sobre el valor total · 0..100 · `null` sin base. */
  netoPct: number | null;
  /** `true` cuando no hay valoración y la revalorización se desconoce. */
  sinValoracion: boolean;
  /** `true` cuando el valor actual está por debajo del coste (minusvalía). */
  hayMinusvalia: boolean;
}

/**
 * Descompone el patrimonio neto en sus tres orígenes — capital aportado de tu
 * bolsillo, deuda ya amortizada y revalorización de mercado — más la deuda que
 * aún no es tuya. Identidad exacta:
 *
 *   cashAportado + deudaAmortizada + revalorización = patrimonio neto
 *   patrimonio neto + deudaPendiente               = valor actual
 *
 * Todo se deriva de datos ya calculados (coste, valor, deuda y principal
 * inicial de la financiación); no toca servicios ni stores.
 */
export function derivarComposicion(props: ComposicionPatrimonioNetoProps): ComposicionModelo {
  const {
    costeAdquisicion,
    valorActual,
    deudaPendiente,
    patrimonioNeto,
    revalorizacion,
    principalInicialTotal,
  } = props;

  const sinValoracion = valorActual === null;
  const reval = revalorizacion ?? 0;

  const cashAportado = costeAdquisicion - principalInicialTotal;
  const deudaAmortizada = principalInicialTotal - deudaPendiente;

  const segmentos: Segmento[] = [
    { key: 'cash', label: 'Cash aportado', amount: cashAportado },
    { key: 'amortizada', label: 'Deuda amortizada', amount: deudaAmortizada },
    { key: 'revalorizacion', label: 'Revalorización', amount: reval },
    { key: 'deudaPendiente', label: 'Deuda pendiente', amount: deudaPendiente },
  ];

  const valorTotal = patrimonioNeto + deudaPendiente;
  const netoPct = valorTotal > 0 ? Math.round((patrimonioNeto / valorTotal) * 100) : null;

  return {
    segmentos,
    valorTotal,
    patrimonioNeto,
    netoPct,
    sinValoracion,
    hayMinusvalia: !sinValoracion && reval < 0,
  };
}

/** Ancho (%) de cada segmento en la barra · solo pesos positivos · normalizado a 100. */
function anchosBarra(segmentos: Segmento[]): Map<Tono, number> {
  const positivos = segmentos.map((s) => Math.max(s.amount, 0));
  const denom = positivos.reduce((sum, v) => sum + v, 0);
  const anchos = new Map<Tono, number>();
  segmentos.forEach((s, i) => {
    anchos.set(s.key, denom > 0 ? (positivos[i] / denom) * 100 : 0);
  });
  return anchos;
}

/**
 * «De qué se compone tu patrimonio neto en este activo»: barra apilada que
 * reparte el valor actual entre lo que es tuyo (capital + deuda amortizada +
 * revalorización) y la deuda que aún no lo es.
 */
const ComposicionPatrimonioNeto: React.FC<ComposicionPatrimonioNetoProps> = (props) => {
  const modelo = useMemo(() => derivarComposicion(props), [props]);
  const anchos = useMemo(() => anchosBarra(modelo.segmentos), [modelo.segmentos]);

  // Ítems con peso: se ocultan los que no aportan nada a la historia
  // (p. ej. sin financiación no hay deuda amortizada ni pendiente).
  const visibles = modelo.segmentos.filter(
    (s) => s.amount > 0 || s.key === 'cash' || s.key === 'revalorizacion',
  );

  const claseSeg: Record<Tono, string> = {
    cash: styles.segCash,
    amortizada: styles.segAmortizada,
    revalorizacion: styles.segReval,
    deudaPendiente: styles.segDeuda,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.hd}>
        <span className={styles.netoLabel}>
          Patrimonio neto ·{' '}
          <b className={styles.netoValue}>
            <MoneyValue value={modelo.patrimonioNeto} decimals={0} />
          </b>
          {modelo.netoPct !== null && (
            <span className={styles.netoPct}> · {modelo.netoPct} %</span>
          )}
        </span>
        <span className={styles.hint}>de qué se compone</span>
      </div>

      <div
        className={styles.bar}
        role="img"
        aria-label="Composición del patrimonio neto sobre el valor actual"
      >
        {modelo.segmentos.map((s) => {
          const width = anchos.get(s.key) ?? 0;
          if (width <= 0) return null;
          return (
            <div
              key={s.key}
              className={`${styles.seg} ${claseSeg[s.key]}`}
              style={{ width: `${width}%` }}
              title={s.label}
            >
              {width >= 16 && <span className={styles.segTxt}>{s.label}</span>}
            </div>
          );
        })}
      </div>

      <div className={styles.legend}>
        {visibles.map((s) => (
          <div key={s.key} className={styles.legItem}>
            <span className={styles.legLabel}>
              <span className={`${styles.sw} ${claseSeg[s.key]}`} />
              {s.label}
            </span>
            <span
              className={`${styles.legValue} ${
                s.key === 'revalorizacion' && modelo.hayMinusvalia ? styles.neg : ''
              }`}
            >
              {s.key === 'revalorizacion' && s.amount < 0 && '−'}
              <MoneyValue value={Math.abs(s.amount)} decimals={0} />
            </span>
          </div>
        ))}
      </div>

      {(modelo.sinValoracion || modelo.hayMinusvalia) && (
        <div className={styles.caption}>
          {modelo.sinValoracion
            ? 'sobre coste de adquisición · aún sin valorar'
            : 'el valor actual está por debajo del coste · minusvalía latente'}
        </div>
      )}
    </div>
  );
};

export default ComposicionPatrimonioNeto;
