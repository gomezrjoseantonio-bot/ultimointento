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

/** Una cuota vencida, ya redondeada a céntimos tal y como se va a guardar. */
export interface CuotaVencida {
  periodo: PeriodoPrestamo;
  /** Retención practicada sobre los intereses del periodo. */
  retenido: number;
  /** Lo que habrá entrado en la cuenta: cuota − retención. */
  neto: number;
}

export interface CuotasVencidas {
  cuotas: CuotaVencida[];
  /** Intereses brutos devengados en las cuotas ya vencidas. */
  intereses: number;
  /** Neto total · suma exacta de los netos por cuota, sin deriva. */
  neto: number;
  /** Fecha de la última cuota vencida (`YYYY-MM-DD`). */
  ultima: string;
}

const aCentimos = (valor: number): number => Math.round(valor * 100) / 100;

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

  // Se redondea AQUÍ, una sola vez, y de estos importes salen tanto el resumen
  // que ve el usuario como los pagos que se guardan. Si cada uno redondease por
  // su cuenta, el total anunciado no cuadraría con la suma de los pagos.
  const tasaRet = (params.retencionPorcentaje || 0) / 100;
  const cuotas: CuotaVencida[] = periodos.map((periodo) => {
    const retenido = aCentimos(periodo.interes * tasaRet);
    return { periodo, retenido, neto: aCentimos(periodo.cuota - retenido) };
  });

  return {
    cuotas,
    intereses: aCentimos(periodos.reduce((acc, per) => acc + per.interes, 0)),
    neto: aCentimos(cuotas.reduce((acc, c) => acc + c.neto, 0)),
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
  return cuotas.cuotas.map(({ periodo, retenido, neto }) => ({
    id: Number(`${periodo.numero}${Date.parse(periodo.fecha)}`.slice(-12)),
    fecha_pago: periodo.fecha,
    importe_bruto: periodo.interes,
    retencion_fiscal: retenido,
    importe_neto: neto,
    cuenta_destino_id: cuentaDestinoId,
    estado: 'pagado' as const,
  }));
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
          {cuotas.cuotas.length} {cuotas.cuotas.length === 1 ? 'cuota' : 'cuotas'} ya
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
