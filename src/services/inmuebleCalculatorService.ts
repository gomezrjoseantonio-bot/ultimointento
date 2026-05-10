/**
 * Cálculo fiscal puro para el wizard de inmueble (S-WIZARD-INMUEBLE-V4).
 * CERO consultas a stores · CERO efectos · misma función para preview
 * live y para validación al guardar.
 */

export interface InmueblePrevioMejora {
  importe: number;
  tipo: 'mejora' | 'reparacion' | 'ampliacion';
}

export interface InmueblePreviousImprovementInput {
  importe: number;
  tipo: 'mejora' | 'reparacion' | 'ampliacion';
}

export interface InmuebleCalcInput {
  precio: number;
  valorReferencia: number;
  formalizacion: {
    notaria: number;
    registro: number;
    gestoria: number;
    otros: number;
  };
  impuestos: number;
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
  diasArrendado: number;
  /** Mejoras posteriores ya cargadas en ATLAS (Bloque 8). Las reparaciones no suman a base amortizable. */
  mejorasPosteriores: InmueblePreviousImprovementInput[];
}

export interface InmuebleResumen {
  costeTotalFormalizacion: number;
  costeBaseAdquisicion: number;        // precio + formalización + impuestos
  costeMejorasPosteriores: number;     // suma de mejoras (no reparaciones)
  porcentajeConstruccion: number;      // V.cat construcción / V.cat total × 100 (0-100)
  costeConstruccion: number;           // (costeBase + mejoras) × % construcción
  baseAmortizable: number;             // max(costeConstruccion, V.cat construcción)
  amortizacionAnual: number;           // baseAmortizable × 0.03
  amortizacionProrrateada: number;     // amortizacionAnual × diasArrendado / 365
  porcentajeOcupacion: number;         // diasArrendado / 365 × 100
}

const safe = (n: number | undefined | null): number => {
  if (typeof n !== 'number' || !isFinite(n) || isNaN(n)) return 0;
  return n;
};

export function calcularInmuebleResumen(input: InmuebleCalcInput): InmuebleResumen {
  const precio = safe(input.precio);
  const formNotaria = safe(input.formalizacion?.notaria);
  const formRegistro = safe(input.formalizacion?.registro);
  const formGestoria = safe(input.formalizacion?.gestoria);
  const formOtros = safe(input.formalizacion?.otros);
  const impuestos = safe(input.impuestos);
  const vctTotal = safe(input.valorCatastralTotal);
  const vctConstruccion = safe(input.valorCatastralConstruccion);
  const diasArrendado = Math.max(0, Math.min(365, safe(input.diasArrendado)));

  const costeTotalFormalizacion = formNotaria + formRegistro + formGestoria + formOtros;
  const costeBaseAdquisicion = precio + costeTotalFormalizacion + impuestos;

  const mejoras = Array.isArray(input.mejorasPosteriores) ? input.mejorasPosteriores : [];
  const costeMejorasPosteriores = mejoras
    .filter((m) => m && m.tipo !== 'reparacion')
    .reduce((sum, m) => sum + safe(m.importe), 0);

  const porcentajeConstruccion = vctTotal > 0
    ? (vctConstruccion / vctTotal) * 100
    : 0;

  const baseTotalConMejoras = costeBaseAdquisicion + costeMejorasPosteriores;
  const costeConstruccion = baseTotalConMejoras * (porcentajeConstruccion / 100);
  const baseAmortizable = Math.max(costeConstruccion, vctConstruccion);

  const amortizacionAnual = baseAmortizable * 0.03;
  const amortizacionProrrateada = (amortizacionAnual * diasArrendado) / 365;
  const porcentajeOcupacion = (diasArrendado / 365) * 100;

  return {
    costeTotalFormalizacion: round2(costeTotalFormalizacion),
    costeBaseAdquisicion: round2(costeBaseAdquisicion),
    costeMejorasPosteriores: round2(costeMejorasPosteriores),
    porcentajeConstruccion: round2(porcentajeConstruccion),
    costeConstruccion: round2(costeConstruccion),
    baseAmortizable: round2(baseAmortizable),
    amortizacionAnual: round2(amortizacionAnual),
    amortizacionProrrateada: round2(amortizacionProrrateada),
    porcentajeOcupacion: round2(porcentajeOcupacion),
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
