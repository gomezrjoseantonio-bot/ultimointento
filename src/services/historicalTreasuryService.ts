/**
 * historicalTreasuryService.ts
 *
 * Genera treasuryEvents confirmed históricos para los años 2020-2025.
 * Lee datos desde ejerciciosFiscalesCoord, contracts, prestamos y gastosInmueble.
 * La amortización contable (casilla 0117) NUNCA genera evento — no es salida de caja.
 */

import { initDB, TreasuryEvent } from './db';

export interface HistoricalGenerationParams {
  año: number;
  gastosPersonalesMes: number;       // confirmado por el usuario en el wizard
  cuentaIdDefecto?: number;          // cuenta bancaria por defecto para eventos sin cuenta
  fuente: 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual';
}

export interface HistoricalGenerationResult {
  eventsCreated: number;
  totalIngresos: number;
  totalGastos: number;
  cashflowNeto: number;
  gaps: string[];  // conceptos que no pudieron generarse
}

function makeEvento(
  overrides: Omit<TreasuryEvent, 'id' | 'createdAt' | 'updatedAt'>
): Omit<TreasuryEvent, 'id'> {
  const now = new Date().toISOString();
  return { ...overrides, createdAt: now, updatedAt: now };
}

export async function generarHistoricoAño(
  params: HistoricalGenerationParams
): Promise<HistoricalGenerationResult> {
  const db = await initDB();
  const { año, gastosPersonalesMes, cuentaIdDefecto, fuente } = params;
  const gaps: string[] = [];
  const eventos: Omit<TreasuryEvent, 'id'>[] = [];
  let totalIngresos = 0;
  let totalGastos = 0;

  // 1. Limpiar eventos históricos previos del año
  await borrarHistoricoAño(año);

  // 2. NÓMINA — desde ejerciciosFiscalesCoord (casillas en aeat.snapshot)
  const ejercicio = await db.get('ejerciciosFiscalesCoord', año);
  const casillas: Record<string, number> = ejercicio?.aeat?.snapshot ?? {};

  const nominaBruta = Number(casillas['0003'] ?? 0);
  const nominaRetenciones = Number(casillas['0596'] ?? 0);
  const nominaSS = Number(casillas['0013'] ?? 0);
  const nominaNeta = nominaBruta - nominaRetenciones - nominaSS;

  if (nominaNeta > 0) {
    const netoMes = Math.round((nominaNeta / 12) * 100) / 100;
    for (let mes = 1; mes <= 12; mes++) {
      const fecha = `${año}-${String(mes).padStart(2, '0')}-28`;
      eventos.push(makeEvento({
        type: 'income',
        amount: netoMes,
        predictedDate: fecha,
        actualDate: fecha,
        actualAmount: netoMes,
        description: `Nómina neta ${mes}/${año}`,
        sourceType: 'nomina',
        status: 'confirmed',
        año,
        mes,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        accountId: cuentaIdDefecto,
      }));
      totalIngresos += netoMes;
    }
  } else {
    gaps.push(`Nómina ${año}: no disponible en ejerciciosFiscalesCoord`);
  }

  // 3. AUTÓNOMO — ingresos (VE1II1) - retenciones (RETENED)
  const autIngresos = Number(casillas['VE1II1'] ?? 0);
  const autRet = Number(casillas['RETENED'] ?? 0);
  const autNeto = autIngresos - autRet;

  if (autNeto > 0) {
    const netoMes = Math.round((autNeto / 12) * 100) / 100;
    for (let mes = 1; mes <= 12; mes++) {
      const fecha = `${año}-${String(mes).padStart(2, '0')}-15`;
      eventos.push(makeEvento({
        type: 'income',
        amount: netoMes,
        predictedDate: fecha,
        actualDate: fecha,
        actualAmount: netoMes,
        description: `Autónomo neto ${mes}/${año}`,
        sourceType: 'autonomo_ingreso',
        status: 'confirmed',
        año,
        mes,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        accountId: cuentaIdDefecto,
      }));
      totalIngresos += netoMes;
    }
  }

  // 4. RESULTADO IRPF — evento en junio del año siguiente
  if (ejercicio) {
    const resultado =
      ejercicio.aeat?.resumen?.resultado ??
      Number(casillas['CDIF'] ?? 0);
    if (resultado !== 0) {
      const fechaIrpf = `${año + 1}-06-30`;
      eventos.push(makeEvento({
        type: resultado > 0 ? 'expense' : 'income',
        amount: Math.abs(resultado),
        predictedDate: fechaIrpf,
        actualDate: fechaIrpf,
        actualAmount: Math.abs(resultado),
        description: resultado > 0 ? `Pago IRPF ${año}` : `Devolución IRPF ${año}`,
        sourceType: 'irpf_prevision',
        status: 'confirmed',
        año,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        accountId: cuentaIdDefecto,
      }));
      if (resultado > 0) totalGastos += resultado;
      else totalIngresos += Math.abs(resultado);
    }
  } else {
    if (nominaNeta <= 0 && autNeto <= 0) {
      gaps.push(`Ejercicio ${año}: no encontrado en ejerciciosFiscalesCoord`);
    }
  }

  // 5. RENTAS DE ALQUILER — desde contracts.ejerciciosFiscales[año]
  const contracts = await db.getAll('contracts');
  for (const contract of contracts) {
    const efAño = contract.ejerciciosFiscales?.[año];
    if (!efAño?.importeDeclarado) continue;

    if (contract.estadoContrato === 'sin_identificar') {
      // Renta anual sin desglose mensual
      const fechaAnual = `${año}-06-30`;
      eventos.push(makeEvento({
        type: 'income',
        amount: efAño.importeDeclarado,
        predictedDate: fechaAnual,
        actualDate: fechaAnual,
        actualAmount: efAño.importeDeclarado,
        description: `Rentas declaradas ${año} - Inmueble ${contract.inmuebleId} (sin vincular)`,
        sourceType: 'contrato',
        status: 'confirmed',
        año,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        sourceId: contract.id,
        inmuebleId: contract.inmuebleId,
        accountId: cuentaIdDefecto,
      }));
      totalIngresos += efAño.importeDeclarado;
      continue;
    }

    if (efAño.estado !== 'declarado') continue;

    // Calcular meses activos del contrato en el año
    const inicioContrato = new Date(contract.fechaInicio);
    const finContrato = new Date(contract.fechaFin);
    const inicioAño = new Date(`${año}-01-01`);
    const finAño = new Date(`${año}-12-31`);
    const efectivoInicio = inicioContrato > inicioAño ? inicioContrato : inicioAño;
    const efectivoFin = finContrato < finAño ? finContrato : finAño;

    if (efectivoInicio > efectivoFin) continue;

    const mesInicio = efectivoInicio.getMonth() + 1;
    const mesFin = efectivoFin.getMonth() + 1;
    const mesesActivos = mesFin - mesInicio + 1;
    const importeMes = Math.round((efAño.importeDeclarado / mesesActivos) * 100) / 100;

    for (let mes = mesInicio; mes <= mesFin; mes++) {
      const fecha = `${año}-${String(mes).padStart(2, '0')}-05`;
      eventos.push(makeEvento({
        type: 'income',
        amount: importeMes,
        predictedDate: fecha,
        actualDate: fecha,
        actualAmount: importeMes,
        description: `Renta ${contract.inquilino?.nombre ?? 'Inquilino'} ${mes}/${año}`,
        sourceType: 'contrato',
        status: 'confirmed',
        año,
        mes,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        sourceId: contract.id,
        contratoId: contract.id,
        inmuebleId: contract.inmuebleId,
        accountId: cuentaIdDefecto,
      }));
      totalIngresos += importeMes;
    }
  }

  // 6. CUOTAS DE PRÉSTAMOS — desde prestamos.cuadroAmortizacion
  const prestamos = await db.getAll('prestamos');
  for (const prestamo of prestamos) {
    if (!prestamo.cuadroAmortizacion || prestamo.cuadroAmortizacion.length === 0) {
      gaps.push(`Préstamo "${prestamo.nombre ?? prestamo.id}": sin cuadro de amortización`);
      continue;
    }
    const cuotasAño = prestamo.cuadroAmortizacion.filter(
      (c: { fecha?: string }) => c.fecha?.startsWith(`${año}`)
    );
    for (const cuota of cuotasAño) {
      const c = cuota as { fecha?: string; cuota?: number; cuotaTotal?: number };
      const cuotaTotal = c.cuota ?? c.cuotaTotal ?? 0;
      if (!cuotaTotal) continue;
      eventos.push(makeEvento({
        type: 'expense',
        amount: cuotaTotal,
        predictedDate: c.fecha ?? `${año}-01-01`,
        actualDate: c.fecha ?? `${año}-01-01`,
        actualAmount: cuotaTotal,
        description: `Cuota ${prestamo.nombre ?? 'Préstamo'} ${c.fecha?.slice(0, 7) ?? año}`,
        sourceType: prestamo.tipo === 'hipoteca' ? 'hipoteca' : 'prestamo',
        status: 'confirmed',
        año,
        mes: c.fecha ? new Date(c.fecha).getMonth() + 1 : undefined,
        certeza: 'calculado',
        fuenteHistorica: 'atlas_nativo',
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        prestamoId: String(prestamo.id),
        sourceId: prestamo.id,
        inmuebleId: prestamo.inmuebleId,
        accountId: cuentaIdDefecto,
      }));
      totalGastos += cuotaTotal;
    }
  }

  // 7. GASTOS OPERATIVOS DE INMUEBLE — desde gastosInmueble
  const gastosInmueble = await db.getAll('gastosInmueble');
  const gastosDelAño = gastosInmueble.filter(
    (g: { año?: number; ejercicio?: number }) => (g.año ?? g.ejercicio) === año
  );

  // Gastos puntuales (un único evento al mes indicado)
  const gastosPuntuales = [
    { campo: 'reparacionConservacion', mes: 1, etiqueta: 'Reparación y conservación' },
    { campo: 'seguros', mes: 1, etiqueta: 'Seguros' },
    { campo: 'ibiTasas', mes: 9, etiqueta: 'IBI y tasas' },
  ] as const;

  // Gastos periódicos (distribuidos en 12 mensualidades)
  const gastosMensuales = [
    { campo: 'interesesFinanciacion', etiqueta: 'Intereses financiación' },
    { campo: 'comunidad', etiqueta: 'Comunidad' },
    { campo: 'suministros', etiqueta: 'Suministros' },
    { campo: 'serviciosTerceros', etiqueta: 'Servicios gestión' },
  ] as const;

  for (const gasto of gastosDelAño) {
    const inmuebleId = (gasto as { inmuebleId?: number; propertyId?: number }).inmuebleId
      ?? (gasto as { inmuebleId?: number; propertyId?: number }).propertyId;

    for (const { campo, mes, etiqueta } of gastosPuntuales) {
      const importe = Number((gasto as Record<string, unknown>)[campo] ?? 0);
      if (!importe) continue;
      const fecha = `${año}-${String(mes).padStart(2, '0')}-01`;
      eventos.push(makeEvento({
        type: 'expense',
        amount: importe,
        predictedDate: fecha,
        actualDate: fecha,
        actualAmount: importe,
        description: `${etiqueta} ${año}${inmuebleId ? ` - Inmueble ${inmuebleId}` : ''}`,
        sourceType: 'gasto',
        status: 'confirmed',
        año,
        mes,
        certeza: 'declarado',
        fuenteHistorica: fuente,
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        inmuebleId,
        accountId: cuentaIdDefecto,
      }));
      totalGastos += importe;
    }

    for (const { campo, etiqueta } of gastosMensuales) {
      const importeAnual = Number((gasto as Record<string, unknown>)[campo] ?? 0);
      if (!importeAnual) continue;
      const importeMes = Math.round((importeAnual / 12) * 100) / 100;
      for (let mes = 1; mes <= 12; mes++) {
        const fecha = `${año}-${String(mes).padStart(2, '0')}-01`;
        eventos.push(makeEvento({
          type: 'expense',
          amount: importeMes,
          predictedDate: fecha,
          actualDate: fecha,
          actualAmount: importeMes,
          description: `${etiqueta} ${mes}/${año}${inmuebleId ? ` - Inmueble ${inmuebleId}` : ''}`,
          sourceType: 'gasto',
          status: 'confirmed',
          año,
          mes,
          certeza: 'declarado',
          fuenteHistorica: fuente,
          ejercicioFiscalOrigen: año,
          generadoPor: 'historicalTreasuryService',
          inmuebleId,
          accountId: cuentaIdDefecto,
        }));
        totalGastos += importeMes;
      }
    }
    // amortización (0117) excluida — es gasto contable, no salida de caja
  }

  // 8. GASTOS PERSONALES — distribuidos mensualmente
  if (gastosPersonalesMes > 0) {
    for (let mes = 1; mes <= 12; mes++) {
      const fecha = `${año}-${String(mes).padStart(2, '0')}-15`;
      eventos.push(makeEvento({
        type: 'expense',
        amount: gastosPersonalesMes,
        predictedDate: fecha,
        actualDate: fecha,
        actualAmount: gastosPersonalesMes,
        description: `Gastos personales estimados ${mes}/${año}`,
        sourceType: 'personal_expense',
        status: 'confirmed',
        año,
        mes,
        certeza: 'estimado',
        fuenteHistorica: 'manual',
        ejercicioFiscalOrigen: año,
        generadoPor: 'historicalTreasuryService',
        accountId: cuentaIdDefecto,
      }));
      totalGastos += gastosPersonalesMes;
    }
  }

  // 9. Persistir todos los eventos
  for (const evento of eventos) {
    await db.add('treasuryEvents', evento);
  }

  return {
    eventsCreated: eventos.length,
    totalIngresos: Math.round(totalIngresos * 100) / 100,
    totalGastos: Math.round(totalGastos * 100) / 100,
    cashflowNeto: Math.round((totalIngresos - totalGastos) * 100) / 100,
    gaps,
  };
}

export async function borrarHistoricoAño(año: number): Promise<void> {
  const db = await initDB();
  const todos = await db.getAllFromIndex('treasuryEvents', 'año', año);
  const historicos = todos.filter(e => e.generadoPor === 'historicalTreasuryService');
  for (const evento of historicos) {
    if (evento.id) await db.delete('treasuryEvents', evento.id);
  }
}

export async function tieneHistoricoGenerado(año: number): Promise<boolean> {
  const db = await initDB();
  const todos = await db.getAllFromIndex('treasuryEvents', 'año', año);
  return todos.some(e => e.generadoPor === 'historicalTreasuryService');
}
