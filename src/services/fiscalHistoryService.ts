import { EstadoEjercicio } from './db';
import { getEjercicio } from './ejercicioFiscalService';
import { calcularDeclaracionIRPF } from './irpfCalculationService';
import { obtenerSnapshotDeclaracion } from './snapshotDeclaracionService';

export type FuenteHistorico = 'vivo' | 'cerrado' | 'declarado' | 'sin_datos';

export interface AnioHistoricoFiscal {
  ejercicio: number;
  cuotaLiquida: number;
  retenciones: number;
  resultado: number;
  tipoEfectivo: number;
  fuente: FuenteHistorico;
  estado?: EstadoEjercicio;
  origen?: 'calculado' | 'importado' | 'mixto';
  snapshotId?: number;
}

function fuenteFromEstado(estado: EstadoEjercicio): FuenteHistorico {
  if (estado === 'declarado') return 'declarado';
  if (estado === 'cerrado') return 'cerrado';
  return 'vivo';
}

export async function cargarHistoricoFiscal(years: number[]): Promise<AnioHistoricoFiscal[]> {
  const currentYear = new Date().getFullYear();

  const rows = await Promise.all(
    years.map(async (year): Promise<AnioHistoricoFiscal> => {
      const ejercicio = await getEjercicio(year);

      if (year === currentYear) {
        const decl = await calcularDeclaracionIRPF(year, { usarConciliacion: true });
        return {
          ejercicio: year,
          cuotaLiquida: decl.liquidacion.cuotaLiquida ?? 0,
          retenciones: decl.retenciones.total ?? 0,
          resultado: decl.resultado ?? 0,
          tipoEfectivo: decl.tipoEfectivo ?? 0,
          fuente: 'vivo',
          estado: 'vivo',
          origen: ejercicio?.origen ?? 'calculado',
          snapshotId: undefined,
        };
      }

      if (!ejercicio) {
        return {
          ejercicio: year,
          cuotaLiquida: 0,
          retenciones: 0,
          resultado: 0,
          tipoEfectivo: 0,
          fuente: 'sin_datos',
        };
      }

      const snapshot = ejercicio.snapshotId ? await obtenerSnapshotDeclaracion(year) : null;
      const cuotaLiquida = snapshot?.datos.liquidacion?.cuotaLiquida ?? 0;
      const retenciones = ejercicio.resumen?.retencionesYPagos ?? 0;
      const resultado = ejercicio.resumen?.resultado ?? 0;
      const baseGeneral = snapshot?.datos.baseGeneral?.total ?? ejercicio.resumen?.baseImponibleGeneral ?? 0;
      const tipoEfectivo = baseGeneral > 0 ? (cuotaLiquida / baseGeneral) * 100 : 0;

      return {
        ejercicio: year,
        cuotaLiquida,
        retenciones,
        resultado,
        tipoEfectivo,
        fuente: fuenteFromEstado(ejercicio.estado),
        estado: ejercicio.estado,
        origen: ejercicio.origen,
        snapshotId: ejercicio.snapshotId,
      };
    })
  );

  return rows.sort((a, b) => b.ejercicio - a.ejercicio);
}
