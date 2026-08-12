import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './GananciaAcumuladaCard.module.css';

export interface GananciaAcumuladaCardProps {
  /** Revalorización latente · valorActual − coste · `null` sin valoración. */
  revalorizacion: number | null;
  /** Rentas netas declaradas acumuladas (IRPF) · 0 si aún no hay ejercicios. */
  rentasAcumuladas: number;
  /** Coste de adquisición · base del «sobre X de coste». */
  costeBase: number;
  /** Año desde el que se acumula (primer ejercicio declarado) · opcional. */
  desdeAnio?: number | null;
}

/** Formatea un importe entero en es-ES sin símbolo · para la ecuación compacta. */
const formatNum = (valor: number): string =>
  Math.round(Math.abs(valor)).toLocaleString('es-ES', { maximumFractionDigits: 0 });

/**
 * «Ganancia acumulada»: lo que el activo ha dado desde su compra, sumando la
 * revalorización latente y las rentas netas ya declaradas a Hacienda. Las
 * rentas crecen a medida que se declaran ejercicios; si aún no hay ninguno,
 * la card muestra solo la revalorización.
 */
const GananciaAcumuladaCard: React.FC<GananciaAcumuladaCardProps> = ({
  revalorizacion,
  rentasAcumuladas,
  costeBase,
  desdeAnio,
}) => {
  const revalKnown = revalorizacion !== null;
  const total = (revalorizacion ?? 0) + rentasAcumuladas;
  const signo = total >= 0 ? '+' : '−';

  const componentes: Array<{ key: string; etiqueta: string; valor: number }> = [];
  if (revalKnown) componentes.push({ key: 'reval', etiqueta: 'reval.', valor: revalorizacion });
  if (rentasAcumuladas !== 0) {
    componentes.push({ key: 'rentas', etiqueta: 'rentas', valor: rentasAcumuladas });
  }

  return (
    <div className={styles.card}>
      <div className={styles.hd}>
        <span className={styles.label}>Ganancia acumulada</span>
      </div>

      <div className={styles.big}>
        {signo}
        <MoneyValue value={Math.abs(total)} decimals={0} />
      </div>

      {componentes.length > 0 && (
        <div className={styles.flow} aria-hidden="true">
          {componentes.map((c, i) => (
            <React.Fragment key={c.key}>
              {i > 0 && <span className={styles.op}>+</span>}
              <span className={styles.am}>
                {c.valor < 0 && '−'}
                {formatNum(c.valor)}
              </span>
              <span className={styles.tag}>{c.etiqueta}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className={styles.sub}>
        sobre <MoneyValue value={costeBase} decimals={0} /> de coste
        {desdeAnio ? ` · desde ${desdeAnio}` : ''}
      </div>
    </div>
  );
};

export default GananciaAcumuladaCard;
