// T27.3 · utility pura · calcula el "acumulado real" de un fondo aplicando
// el regla MIN por cuenta + cascada de respaldo cuando varios fondos comparten
// la misma cuenta.
//
// REGLAS DE CASCADA (especificación spec §E.2 + decisión Jose · prioridad):
//   1. Para cada cuenta en `fondo.cuentasAsignadas`:
//      - Saldo real de la cuenta (input externo · `saldosCuentas` map)
//      - Importe asignado por este fondo (en € · ver normalización abajo)
//      - "Importe real respaldado por este fondo" = MIN(saldo, asignado),
//        AJUSTADO por la cascada cuando hay varios fondos en la misma cuenta
//   2. Cascada · ÚLTIMO en pagar = PRIMERO en estar respaldado:
//      - Prioridad 'alta' paga la última (= primero en estar respaldada)
//      - A igual prioridad · MÁS RECIENTE paga primero (= MENOR createdAt
//        está respaldado primero · MAYOR createdAt paga primero)
//   3. Suma de "importe real respaldado" de todas las cuentas = acumulado real
//
// NORMALIZACIÓN cuentasAsignadas (3 modos union):
//   - `completo` → toma todo el saldo de la cuenta como importe asignado
//   - `parcial fijo` → `importeAsignado` literal
//   - `parcial porcentaje` → `(porcentajeAsignado / 100) * saldoCuenta`
//
// El campo `acumuladoReal` NUNCA se persiste · es siempre derivado de los
// saldos actuales de las cuentas + las asignaciones de los fondos.

import type { FondoAhorro, FondoPrioridad } from '../../../../types/miPlan';
import { importeEfectivoDeAsignacion } from './computeDisponibleEnCuenta';

export interface ComputeAcumuladoArgs {
  fondo: FondoAhorro;
  saldosCuentas: Map<number, number>;
  todosFondos: FondoAhorro[];
}

export interface ComputeAcumuladoPorCuenta {
  cuentaId: number;
  saldoCuenta: number;
  importeAsignadoEsteFondo: number;
  importeRealEsteFondo: number;
}

export interface ComputeAcumuladoResult {
  acumuladoReal: number;
  metaImporte: number;
  progresoPct: number;
  porCuenta: ComputeAcumuladoPorCuenta[];
}

/** Default retroactivo · registros V66 sin campo se tratan como 'normal'. */
function prioridadDe(f: FondoAhorro): FondoPrioridad {
  return f.prioridad ?? 'normal';
}

export function computeAcumuladoFondo(
  args: ComputeAcumuladoArgs,
): ComputeAcumuladoResult {
  const porCuenta: ComputeAcumuladoPorCuenta[] = [];
  let acumuladoReal = 0;

  for (const asigEsteFondo of args.fondo.cuentasAsignadas) {
    const cuentaId = asigEsteFondo.cuentaId;
    const saldoCuenta = args.saldosCuentas.get(cuentaId) ?? 0;

    // Lista de fondos que tocan esta cuenta · incluido el actual.
    const fondosEnCuenta = args.todosFondos
      .filter((f) => f.activo)
      .map((f) => {
        const asig = f.cuentasAsignadas.find((c) => c.cuentaId === cuentaId);
        return { fondo: f, asig };
      })
      .filter((x): x is { fondo: FondoAhorro; asig: NonNullable<typeof x.asig> } =>
        Boolean(x.asig),
      );

    // Orden de pago · prioridad normal paga primero · alta paga última.
    // Dentro de la misma prioridad · más reciente paga primero.
    fondosEnCuenta.sort((a, b) => {
      const prioA = prioridadDe(a.fondo) === 'alta' ? 1 : 0;
      const prioB = prioridadDe(b.fondo) === 'alta' ? 1 : 0;
      if (prioA !== prioB) return prioA - prioB;
      // Misma prioridad · más reciente paga primero (createdAt mayor primero)
      return b.fondo.createdAt.localeCompare(a.fondo.createdAt);
    });

    // Orden de respaldo = inverso del orden de pago.
    // El que paga ÚLTIMO es el PRIMERO en estar respaldado.
    const ordenRespaldo = [...fondosEnCuenta].reverse();

    let saldoRestante = saldoCuenta;
    let importeRealEsteFondo = 0;
    for (const item of ordenRespaldo) {
      const importeAsignado = importeEfectivoDeAsignacion(item.asig, saldoCuenta);
      const respaldo = Math.min(importeAsignado, saldoRestante);
      saldoRestante -= respaldo;
      if (item.fondo.id === args.fondo.id) {
        importeRealEsteFondo = respaldo;
      }
    }

    porCuenta.push({
      cuentaId,
      saldoCuenta,
      importeAsignadoEsteFondo: importeEfectivoDeAsignacion(
        asigEsteFondo,
        saldoCuenta,
      ),
      importeRealEsteFondo,
    });
    acumuladoReal += importeRealEsteFondo;
  }

  const metaImporte = args.fondo.metaImporte ?? 0;
  const progresoPct =
    metaImporte > 0 ? Math.min(100, (acumuladoReal / metaImporte) * 100) : 0;

  return { acumuladoReal, metaImporte, progresoPct, porCuenta };
}
