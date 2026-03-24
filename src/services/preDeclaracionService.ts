// ATLAS — T26: Pre-declaración automática
// Genera un borrador con todas las casillas IRPF que ATLAS puede calcular.

import { DeclaracionIRPF, calcularDeclaracionIRPF } from './irpfCalculationService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CasillaPreDeclaracion {
  numero: string;        // "0435"
  nombre: string;        // "Base imponible general"
  valor: number;
  origen: 'calculado' | 'importado' | 'recurrente' | 'manual' | 'estimado';
  origenDetalle: string; // "Rentas cobradas Tenderina 64 4D"
  seccion: string;
  inmuebleRef?: string;
}

export interface PreDeclaracion {
  ejercicio: number;
  fechaGeneracion: string;
  tipo: 'estimacion' | 'borrador'; // en curso vs cerrado
  casillas: CasillaPreDeclaracion[];
  resumen: {
    resultado: number;
    cuotaLiquida: number;
    totalRetenciones: number;
    tipoMedio: number;
  };
  cobertura: {
    casillasCalculadas: number;
    casillasEstimadas: number;
    casillasVacias: number;
  };
  avisos: string[];
}

// ─── Generación de casillas ──────────────────────────────────────────────────

function generarCasillasDesdeDeclaracion(decl: DeclaracionIRPF): {
  casillas: CasillaPreDeclaracion[];
  avisos: string[];
} {
  const casillas: CasillaPreDeclaracion[] = [];
  const avisos: string[] = [];

  // ── Rendimientos del trabajo ──
  const trabajo = decl.baseGeneral.rendimientosTrabajo;
  if (trabajo) {
    casillas.push({
      numero: '0001',
      nombre: 'Retribuciones dinerarias',
      valor: trabajo.salarioBrutoAnual,
      origen: 'calculado',
      origenDetalle: 'Nóminas registradas',
      seccion: 'Rendimientos del trabajo',
    });
    if (trabajo.especieAnual > 0) {
      casillas.push({
        numero: '0003',
        nombre: 'Retribuciones en especie',
        valor: trabajo.especieAnual,
        origen: 'calculado',
        origenDetalle: 'Nóminas - retribución en especie',
        seccion: 'Rendimientos del trabajo',
      });
    }
    casillas.push({
      numero: '0012',
      nombre: 'Cotizaciones Seguridad Social',
      valor: trabajo.cotizacionSS,
      origen: 'calculado',
      origenDetalle: 'Nóminas - cotización SS',
      seccion: 'Rendimientos del trabajo',
    });
    casillas.push({
      numero: '0015',
      nombre: 'Otros gastos deducibles (2.000 €)',
      valor: 2000,
      origen: 'calculado',
      origenDetalle: 'Art. 19.2.f LIRPF',
      seccion: 'Rendimientos del trabajo',
    });
    casillas.push({
      numero: '0022',
      nombre: 'Rendimiento neto del trabajo',
      valor: trabajo.rendimientoNeto,
      origen: 'calculado',
      origenDetalle: 'Bruto + especie - SS - gastos',
      seccion: 'Rendimientos del trabajo',
    });
  }

  // ── Rendimientos capital inmobiliario ──
  for (const inm of decl.baseGeneral.rendimientosInmuebles) {
    if (inm.inmuebleId < 0) continue; // Skip synthetic
    const ref = inm.alias;

    casillas.push({
      numero: '0063',
      nombre: 'Ingresos íntegros computados',
      valor: inm.ingresosIntegros,
      origen: 'calculado',
      origenDetalle: `Rentas cobradas ${ref}`,
      seccion: 'Capital inmobiliario',
      inmuebleRef: ref,
    });
    casillas.push({
      numero: '0069',
      nombre: 'Gastos deducibles',
      valor: inm.gastosDeducibles,
      origen: 'calculado',
      origenDetalle: `Gastos registrados ${ref}`,
      seccion: 'Capital inmobiliario',
      inmuebleRef: ref,
    });
    casillas.push({
      numero: '0111',
      nombre: 'Amortización inmueble',
      valor: inm.amortizacion,
      origen: 'calculado',
      origenDetalle: `Calculado (VC×%c×3%) ${ref}`,
      seccion: 'Capital inmobiliario',
      inmuebleRef: ref,
    });
    casillas.push({
      numero: '0128',
      nombre: 'Rendimiento neto',
      valor: inm.rendimientoNetoAlquiler,
      origen: 'calculado',
      origenDetalle: `Ingresos - gastos - amortización ${ref}`,
      seccion: 'Capital inmobiliario',
      inmuebleRef: ref,
    });
    if (inm.reduccionHabitual > 0) {
      casillas.push({
        numero: '0134',
        nombre: 'Reducción arrendamiento vivienda',
        valor: inm.reduccionHabitual,
        origen: 'calculado',
        origenDetalle: `${Math.round(inm.porcentajeReduccionHabitual * 100)}% s/ rdto neto ${ref}`,
        seccion: 'Capital inmobiliario',
        inmuebleRef: ref,
      });
    }
    casillas.push({
      numero: '0143',
      nombre: 'Rendimiento neto reducido',
      valor: inm.rendimientoNetoReducido,
      origen: 'calculado',
      origenDetalle: `Rdto neto - reducción ${ref}`,
      seccion: 'Capital inmobiliario',
      inmuebleRef: ref,
    });

    if (inm.imputacionRenta > 0) {
      casillas.push({
        numero: '0083',
        nombre: 'Imputación de rentas inmobiliarias',
        valor: inm.imputacionRenta,
        origen: 'calculado',
        origenDetalle: `${inm.diasVacio} días vacío ${ref}`,
        seccion: 'Imputación rentas',
        inmuebleRef: ref,
      });
    }

    // Check for missing data
    if (inm.gastosDeducibles === 0 && inm.ingresosIntegros > 0) {
      avisos.push(`Faltan gastos operativos en ${ref}`);
    }
  }

  // ── Imputaciones de rentas ──
  for (const imp of decl.baseGeneral.imputacionRentas) {
    casillas.push({
      numero: '0083',
      nombre: 'Imputación de rentas inmobiliarias',
      valor: imp.imputacion,
      origen: 'calculado',
      origenDetalle: `VC ${Math.round(imp.valorCatastral)} × ${imp.porcentajeImputacion * 100}% × ${imp.diasVacio}/365 ${imp.alias}`,
      seccion: 'Imputación rentas',
      inmuebleRef: imp.alias,
    });
  }

  // ── Actividades económicas ──
  const autonomo = decl.baseGeneral.rendimientosAutonomo;
  if (autonomo) {
    casillas.push({
      numero: '0150',
      nombre: 'Ingresos actividades económicas',
      valor: autonomo.ingresos,
      origen: 'calculado',
      origenDetalle: 'Actividades registradas',
      seccion: 'Actividades económicas',
    });
    casillas.push({
      numero: '0155',
      nombre: 'Gastos actividades económicas',
      valor: autonomo.gastos,
      origen: 'calculado',
      origenDetalle: 'Gastos actividad',
      seccion: 'Actividades económicas',
    });
    casillas.push({
      numero: '0200',
      nombre: 'Rendimiento neto actividades',
      valor: autonomo.rendimientoNeto,
      origen: 'calculado',
      origenDetalle: 'Ingresos - gastos - SS',
      seccion: 'Actividades económicas',
    });
  }

  // ── Capital mobiliario ──
  const rcm = decl.baseAhorro.capitalMobiliario;
  if (rcm.total > 0) {
    if (rcm.intereses > 0) {
      casillas.push({
        numero: '0023',
        nombre: 'Intereses cuentas bancarias',
        valor: rcm.intereses,
        origen: 'calculado',
        origenDetalle: 'Inversiones registradas',
        seccion: 'Capital mobiliario',
      });
    }
    if (rcm.dividendos > 0) {
      casillas.push({
        numero: '0029',
        nombre: 'Dividendos y participaciones',
        valor: rcm.dividendos,
        origen: 'calculado',
        origenDetalle: 'Inversiones registradas',
        seccion: 'Capital mobiliario',
      });
    }
  }

  // ── Capital mobiliario base general ──
  const rcmGeneral = decl.baseGeneral.capitalMobiliarioGeneral;
  if (rcmGeneral && rcmGeneral.total > 0) {
    casillas.push({
      numero: '0046',
      nombre: 'Otros rendimientos capital mobiliario (base general)',
      valor: rcmGeneral.total,
      origen: 'calculado',
      origenDetalle: 'Rendimientos integrados en base general',
      seccion: 'Capital mobiliario',
    });
  }

  // ── Reducciones ──
  if (decl.reducciones.total > 0) {
    casillas.push({
      numero: '0462',
      nombre: 'Reducciones por aportaciones PP',
      valor: decl.reducciones.total,
      origen: 'calculado',
      origenDetalle: 'Planes de pensiones',
      seccion: 'Reducciones',
    });
  }

  // ── Bases y cuotas ──
  casillas.push({
    numero: '0435',
    nombre: 'Base imponible general',
    valor: decl.liquidacion.baseImponibleGeneral,
    origen: 'calculado',
    origenDetalle: 'Suma rendimientos - reducciones',
    seccion: 'Bases y cuotas',
  });
  casillas.push({
    numero: '0460',
    nombre: 'Base imponible del ahorro',
    valor: decl.liquidacion.baseImponibleAhorro,
    origen: 'calculado',
    origenDetalle: 'RCM + ganancias patrimoniales',
    seccion: 'Bases y cuotas',
  });
  casillas.push({
    numero: '0505',
    nombre: 'Cuota íntegra estatal',
    valor: decl.liquidacion.cuotaIntegra,
    origen: 'calculado',
    origenDetalle: 'Cuota general + cuota ahorro - mínimos',
    seccion: 'Bases y cuotas',
  });
  casillas.push({
    numero: '0570',
    nombre: 'Cuota líquida estatal',
    valor: decl.liquidacion.cuotaLiquida,
    origen: 'calculado',
    origenDetalle: 'Cuota íntegra - deducciones',
    seccion: 'Bases y cuotas',
  });

  // ── Retenciones ──
  if (decl.retenciones.trabajo > 0) {
    casillas.push({
      numero: '0596',
      nombre: 'Retenciones del trabajo',
      valor: decl.retenciones.trabajo,
      origen: 'calculado',
      origenDetalle: 'IRPF retenido en nóminas',
      seccion: 'Retenciones',
    });
  }
  if (decl.retenciones.autonomoM130 > 0) {
    casillas.push({
      numero: '0597',
      nombre: 'Pagos fraccionados (M130)',
      valor: decl.retenciones.autonomoM130,
      origen: 'calculado',
      origenDetalle: 'Pagos fraccionados actividad',
      seccion: 'Retenciones',
    });
  }
  if (decl.retenciones.capitalMobiliario > 0) {
    casillas.push({
      numero: '0598',
      nombre: 'Retenciones capital mobiliario',
      valor: decl.retenciones.capitalMobiliario,
      origen: 'calculado',
      origenDetalle: 'Retenciones inversiones',
      seccion: 'Retenciones',
    });
  }
  casillas.push({
    numero: '0609',
    nombre: 'Total retenciones y pagos a cuenta',
    valor: decl.retenciones.total,
    origen: 'calculado',
    origenDetalle: 'Suma retenciones',
    seccion: 'Retenciones',
  });

  // ── Resultado ──
  casillas.push({
    numero: '0610',
    nombre: 'Resultado de la declaración',
    valor: decl.resultado,
    origen: 'calculado',
    origenDetalle: 'Cuota líquida - retenciones',
    seccion: 'Resultado',
  });

  return { casillas, avisos };
}

// ─── Función principal ───────────────────────────────────────────────────────

export async function generarPreDeclaracion(ejercicio: number): Promise<PreDeclaracion> {
  const currentYear = new Date().getFullYear();
  const tipo: PreDeclaracion['tipo'] = ejercicio >= currentYear ? 'estimacion' : 'borrador';

  const declaracion = await calcularDeclaracionIRPF(ejercicio);
  const { casillas, avisos } = generarCasillasDesdeDeclaracion(declaracion);

  const casillasCalculadas = casillas.filter(c => c.origen === 'calculado').length;
  const casillasEstimadas = casillas.filter(c => c.origen === 'estimado').length;

  // Count properties without full expenses
  const inmueblesConIngresos = declaracion.baseGeneral.rendimientosInmuebles
    .filter(i => i.inmuebleId >= 0 && i.ingresosIntegros > 0);
  const inmueblesCompletos = inmueblesConIngresos.filter(i => i.gastosDeducibles > 0).length;
  const totalInmuebles = inmueblesConIngresos.length;

  if (totalInmuebles > 0 && inmueblesCompletos < totalInmuebles) {
    avisos.push(`${inmueblesCompletos} inmuebles completos de ${totalInmuebles}`);
  }

  return {
    ejercicio,
    fechaGeneracion: new Date().toISOString(),
    tipo,
    casillas,
    resumen: {
      resultado: declaracion.resultado,
      cuotaLiquida: declaracion.liquidacion.cuotaLiquida,
      totalRetenciones: declaracion.retenciones.total,
      tipoMedio: declaracion.tipoEfectivo,
    },
    cobertura: {
      casillasCalculadas,
      casillasEstimadas,
      casillasVacias: 0,
    },
    avisos,
  };
}

// ─── Exportación ─────────────────────────────────────────────────────────────

export function exportarPreDeclaracion(preDecl: PreDeclaracion): string {
  const lines: string[] = [];
  lines.push(`ATLAS — Pre-declaración IRPF ${preDecl.ejercicio}`);
  lines.push(`Tipo: ${preDecl.tipo === 'estimacion' ? 'Estimación (ejercicio en curso)' : 'Borrador (ejercicio cerrado)'}`);
  lines.push(`Generado: ${new Date(preDecl.fechaGeneracion).toLocaleString('es-ES')}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  let currentSection = '';
  for (const c of preDecl.casillas) {
    if (c.seccion !== currentSection) {
      currentSection = c.seccion;
      lines.push(`── ${currentSection} ${'─'.repeat(Math.max(0, 50 - currentSection.length))}`);
      lines.push('');
    }
    const valor = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c.valor);
    const nombrePadded = c.nombre + ' '.repeat(Math.max(0, 45 - c.nombre.length));
    const valorPadded = ' '.repeat(Math.max(0, 12 - valor.length)) + valor;
    lines.push(`  ${c.numero}  ${nombrePadded} ${valorPadded} €`);
    lines.push(`         ← ${c.origen.charAt(0).toUpperCase() + c.origen.slice(1)} (${c.origenDetalle})`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  const fmtR = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  lines.push(`  RESULTADO: ${fmtR(preDecl.resumen.resultado)} € (${preDecl.resumen.resultado > 0 ? 'a pagar' : 'a devolver'})`);
  lines.push(`  Cuota líquida: ${fmtR(preDecl.resumen.cuotaLiquida)} €`);
  lines.push(`  Retenciones: ${fmtR(preDecl.resumen.totalRetenciones)} €`);
  lines.push(`  Tipo medio: ${preDecl.resumen.tipoMedio.toFixed(1)}%`);
  lines.push('');
  lines.push(`  Cobertura: ${preDecl.cobertura.casillasCalculadas} casillas calculadas · ${preDecl.cobertura.casillasEstimadas} estimadas`);

  if (preDecl.avisos.length > 0) {
    lines.push('');
    lines.push('  Avisos:');
    for (const aviso of preDecl.avisos) {
      lines.push(`    · ${aviso}`);
    }
  }

  return lines.join('\n');
}
