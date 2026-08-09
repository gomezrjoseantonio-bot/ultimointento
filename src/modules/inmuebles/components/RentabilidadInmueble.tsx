import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './RentabilidadInmueble.module.css';

export interface RentabilidadInmuebleProps {
  rentaMensual: number;
  valorAdquisicion: number;
  gastosPrevistos?: number;
  gastosReales?: number;
}

const RentabilidadInmueble: React.FC<RentabilidadInmuebleProps> = ({
  rentaMensual,
  valorAdquisicion,
  gastosPrevistos,
  gastosReales,
}) => {
  const rentaAnual = rentaMensual * 12;
  const rentabilidadBruta =
    valorAdquisicion > 0 ? (rentaAnual * 100) / valorAdquisicion : undefined;

  // Preferimos gastos reales (más precisos) sobre los previstos (estimados).
  const gastosAnualesDisponibles = gastosReales ?? gastosPrevistos;
  const rentaNeta =
    gastosAnualesDisponibles !== undefined ? rentaAnual - gastosAnualesDisponibles : undefined;
  const rentabilidadNeta =
    valorAdquisicion > 0 && rentaNeta !== undefined
      ? (rentaNeta * 100) / valorAdquisicion
      : undefined;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Rentabilidad del activo</div>
        <div className={styles.sub}>
          Basada en datos disponibles · los valores estimados se marcan con ≈
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Renta mensual</div>
          {rentaMensual > 0 ? (
            <div className={styles.cardValue}>
              <MoneyValue value={rentaMensual} decimals={0} tone="pos" />
            </div>
          ) : (
            <div className={styles.noData}>Sin contrato activo</div>
          )}
          <div className={styles.badge}>Disponible</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Renta anual bruta</div>
          {rentaAnual > 0 ? (
            <div className={styles.cardValue}>
              <MoneyValue value={rentaAnual} decimals={0} tone="pos" />
            </div>
          ) : (
            <div className={styles.noData}>Sin renta activa</div>
          )}
          <div className={styles.badge}>Disponible</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Rentabilidad bruta</div>
          {rentabilidadBruta !== undefined && valorAdquisicion > 0 ? (
            <div className={styles.cardValue}>{rentabilidadBruta.toFixed(2)} %</div>
          ) : (
            <div className={styles.noData}>Sin valor de adquisición</div>
          )}
          <div className={styles.badge}>
            {valorAdquisicion > 0 ? 'Disponible' : 'No disponible'}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Gastos de explotación (anuales)</div>
          {gastosAnualesDisponibles !== undefined ? (
            <>
              <div className={styles.cardValue}>
                <MoneyValue value={gastosAnualesDisponibles} decimals={0} />
              </div>
              <div className={styles.badgeEst}>
                {gastosReales !== undefined ? 'Reales' : '≈ Previstos'}
              </div>
            </>
          ) : (
            <>
              <div className={styles.noData}>Sin gastos registrados</div>
              <div className={styles.badgeNa}>No disponible</div>
            </>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Rentabilidad neta estimada</div>
          {rentabilidadNeta !== undefined ? (
            <>
              <div className={styles.cardValue}>{rentabilidadNeta.toFixed(2)} %</div>
              <div className={styles.badgeEst}>≈ Estimada</div>
            </>
          ) : (
            <>
              <div className={styles.noData}>Faltan datos de gastos o adquisición</div>
              <div className={styles.badgeNa}>No disponible</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentabilidadInmueble;
