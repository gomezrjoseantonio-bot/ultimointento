import { initDB, EstadoEjercicio } from './db';
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
  tienePDF?: boolean;
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
  const db = await initDB();
  const allDocuments = await db.getAll('documents');
  const ejerciciosConPDF = new Set(
    (allDocuments as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
      .filter((documento) => documento.type === 'declaracion_irpf' && typeof documento.metadata?.ejercicio === 'number')
      .map((documento) => documento.metadata!.ejercicio as number),
  );

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
          tienePDF: ejerciciosConPDF.has(year),
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
          tienePDF: ejerciciosConPDF.has(year),
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
        tienePDF: ejerciciosConPDF.has(year),
        estado: ejercicio.estado,
        origen: ejercicio.origen,
        snapshotId: ejercicio.snapshotId,
      };
    })
  );

  return rows.sort((a, b) => b.ejercicio - a.ejercicio);
}

/**
 * Elimina una declaración importada y su PDF archivado.
 */
export async function eliminarDeclaracionImportada(ejercicio: number): Promise<void> {
  const db = await initDB();
  const ejercicioFiscal = await getEjercicio(ejercicio);

  if (!ejercicioFiscal || (ejercicioFiscal.origen !== 'importado' && ejercicioFiscal.origen !== 'mixto')) {
    throw new Error('Solo se pueden eliminar declaraciones importadas');
  }

  if (ejercicioFiscal.snapshotId) {
    await db.delete('snapshotsDeclaracion', ejercicioFiscal.snapshotId);
  }

  if (ejercicioFiscal.resultadoEjercicioId) {
    const resultado = await db.get('resultadosEjercicio', ejercicioFiscal.resultadoEjercicioId) as {
      arrastres?: { generados?: Array<{ arrastreId?: number }> };
    } | undefined;

    await Promise.all(
      (resultado?.arrastres?.generados ?? [])
        .filter((arrastre) => typeof arrastre.arrastreId === 'number')
        .map((arrastre) => db.delete('arrastresIRPF', arrastre.arrastreId as number)),
    );

    await db.delete('resultadosEjercicio', ejercicioFiscal.resultadoEjercicioId);
  }

  const allDocuments = await db.getAll('documents');
  const documentosIRPF = (allDocuments as Array<{ id?: number; type?: string; metadata?: { ejercicio?: number; origen?: string } }>)
    .filter((documento) =>
      documento.type === 'declaracion_irpf'
      && documento.metadata?.ejercicio === ejercicio,
    );

  await Promise.all(
    documentosIRPF
      .filter((documento) => documento.id)
      .map((documento) => db.delete('documents', documento.id as number)),
  );

  await db.delete('ejerciciosFiscales', ejercicioFiscal.ejercicio);
}
