import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './CosteDePropiedadCard.module.css';

export interface CosteDePropiedadCardProps {
  /** Cuota hipotecaria mensual imputada al inmueble. */
  hipoteca: number;
  /** Gasto de mantenimiento mensual (grupo «mantener» / 12). */
  mantenimiento: number;
  /** Gasto de explotación mensual (grupo «explotar» / 12). */
  explotacion: number;
}

/** Formatea un importe entero en es-ES sin símbolo · para la ecuación compacta. */
const formatNum = (valor: number): string =>
  Math.round(valor).toLocaleString('es-ES', { maximumFractionDigits: 0 });

/**
 * «Coste de propiedad»: lo que cuesta tener el activo cada mes, desglosado en
 * hipoteca + mantenimiento + explotación. Solo presenta importes ya calculados
 * (cuota de la financiación y gastos recurrentes previstos); no toca servicios.
 */
const CosteDePropiedadCard: React.FC<CosteDePropiedadCardProps> = ({
  hipoteca,
  mantenimiento,
  explotacion,
}) => {
  const totalMensual = hipoteca + mantenimiento + explotacion;

  const componentes = [
    { key: 'hipoteca', etiqueta: 'hipoteca', valor: hipoteca },
    { key: 'mantenimiento', etiqueta: 'manten.', valor: mantenimiento },
    { key: 'explotacion', etiqueta: 'explot.', valor: explotacion },
  ].filter((c) => c.valor > 0);

  return (
    <div className={styles.card}>
      <div className={styles.hd}>
        <span className={styles.label}>Coste de propiedad</span>
      </div>

      <div className={styles.big}>
        <MoneyValue value={totalMensual} decimals={0} />
        <span className={styles.per}>/mes</span>
      </div>

      {componentes.length > 0 && (
        <div className={styles.flow} aria-hidden="true">
          {componentes.map((c, i) => (
            <React.Fragment key={c.key}>
              {i > 0 && <span className={styles.op}>+</span>}
              <span className={styles.am}>{formatNum(c.valor)}</span>
              <span className={styles.tag}>{c.etiqueta}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className={styles.sub}>
        lo que cuesta tener el activo · <MoneyValue value={totalMensual * 12} decimals={0} />/año
      </div>
    </div>
  );
};

export default CosteDePropiedadCard;
