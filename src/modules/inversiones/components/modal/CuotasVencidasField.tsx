// Bloque "Cuotas ya vencidas" del alta de préstamo.
//
// Un préstamo que se registra a toro pasado arrastra cuotas que ya se
// cobraron. Ese dinero YA está en el saldo del banco, así que darlas por
// cobradas marca el cuadro del préstamo pero NO escribe movimientos de
// tesorería: si los escribiera, el importe se contaría dos veces.

import React from 'react';
import { formatCurrency } from '../../helpers';
import {
  calcularCuadroPrestamo,
  type FrecuenciaCobro,
  type ModalidadDevolucion,
  type PeriodoPrestamo,
} from '../../utils/prestamoCalendario';
import { toISODateLocal } from '../../../../utils/recurrenceDateUtils';
import styles from '../../styles/atlas-inversiones.module.css';

export interface CuotasVencidas {
  periodos: PeriodoPrestamo[];
  /** Intereses brutos devengados en las cuotas ya vencidas. */
  intereses: number;
  /** Neto que habrá entrado en la cuenta (cuota − retención). */
  neto: number;
  /** Retención aplicada, en tanto por uno. */
  tasaRet: number;
  /** Fecha de la última cuota vencida (`YYYY-MM-DD`). */
  ultima: string;
}

/** Cuotas del cuadro cuya fecha ya ha pasado, con el neto que habrán dejado. */
export function calcularCuotasVencidas(params: {
  capital: number;
  tinAnual: number;
  duracionMeses: number;
  frecuencia: FrecuenciaCobro;
  modalidad: ModalidadDevolucion;
  primerCobro: string;
  retencionPorcentaje: number;
}): CuotasVencidas | null {
  const cuadro = calcularCuadroPrestamo(params);
  if (!cuadro) return null;
  const hoy = toISODateLocal(new Date());
  const periodos = cuadro.periodos.filter((per) => per.fecha <= hoy);
  if (!periodos.length) return null;
  const tasaRet = (params.retencionPorcentaje || 0) / 100;
  return {
    periodos,
    tasaRet,
    intereses: periodos.reduce((acc, per) => acc + per.interes, 0),
    neto: periodos.reduce((acc, per) => acc + per.cuota - per.interes * tasaRet, 0),
    ultima: periodos[periodos.length - 1].fecha,
  };
}

/**
 * Convierte esas cuotas en pagos ya cobrados del cuadro del préstamo.
 * Nunca genera movimientos bancarios · ver la nota de cabecera.
 */
export function pagosDeCuotasVencidas(
  cuotas: CuotasVencidas,
  cuentaDestinoId: number,
): Array<{
  id: number;
  fecha_pago: string;
  importe_bruto: number;
  retencion_fiscal: number;
  importe_neto: number;
  cuenta_destino_id: number;
  estado: 'pagado';
}> {
  return cuotas.periodos.map((per) => {
    const retenido = Math.round(per.interes * cuotas.tasaRet * 100) / 100;
    return {
      id: Number(`${per.numero}${Date.parse(per.fecha)}`.slice(-12)),
      fecha_pago: per.fecha,
      importe_bruto: per.interes,
      retencion_fiscal: retenido,
      importe_neto: Math.round((per.cuota - retenido) * 100) / 100,
      cuenta_destino_id: cuentaDestinoId,
      estado: 'pagado' as const,
    };
  });
}

interface Props {
  cuotas: CuotasVencidas;
  darPorCobradas: boolean;
  onChange: (valor: boolean) => void;
}

const CuotasVencidasField: React.FC<Props> = ({ cuotas, darPorCobradas, onChange }) => (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>Cuotas ya vencidas</div>
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--atlas-v5-gold-wash)',
        borderRadius: 8,
        fontSize: 12.5,
        lineHeight: 1.55,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        Con estas fechas el préstamo arrastra{' '}
        <strong>
          {cuotas.periodos.length} {cuotas.periodos.length === 1 ? 'cuota' : 'cuotas'} ya
          vencidas
        </strong>{' '}
        (hasta {cuotas.ultima}), por un neto de{' '}
        <strong>{formatCurrency(cuotas.neto)}</strong> ·{' '}
        {formatCurrency(cuotas.intereses)} de intereses brutos.
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={darPorCobradas}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          Darlas por cobradas · el cuadro las marcará como cobradas.
          <span style={{ display: 'block', color: 'var(--atlas-v5-ink-4)' }}>
            No se crea ningún movimiento en Tesorería: ese dinero ya está en el saldo de
            tu banco y contarlo otra vez lo duplicaría. Desmárcalo si prefieres puntearlas
            una a una.
          </span>
        </span>
      </label>
    </div>
  </div>
);

export default CuotasVencidasField;
