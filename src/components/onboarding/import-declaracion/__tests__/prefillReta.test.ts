// Wizard import XML V2 · pasos 6·7 · sugerencia RETA + construcción de prefills.
import { sugerirTramoReta, TRAMOS_RETA_2024 } from '../../../../constants/retaTramos';
import {
  sugerenciasNomina,
  construirNominaPrefill,
  sugerenciasAutonomo,
  construirAutonomoPrefill,
} from '../prefill';
import type { DeclaracionCompleta } from '../../../../types/declaracionCompleta';

function decl(parcial: Partial<DeclaracionCompleta>): DeclaracionCompleta {
  return {
    meta: { ejercicio: 2024, tipoDeclaracion: 'D' } as any,
    declarante: { nif: 'X', nombreCompleto: 'Y', tributacion: 'individual' } as any,
    inmuebles: [],
    integracion: {} as any,
    resultado: {} as any,
    arrastres: {} as any,
    casillas: {},
    camposExtra: {},
    ...parcial,
  } as DeclaracionCompleta;
}

describe('sugerirTramoReta', () => {
  it('total 0 o negativo → null', () => {
    expect(sugerirTramoReta(0)).toBeNull();
    expect(sugerirTramoReta(-10)).toBeNull();
  });

  it('elige el tramo cuya cuota mensual es la más cercana por debajo de E1G6/12', () => {
    // 3.529,66 / 12 ≈ 294,14 → cuota 294 (índice 5)
    const r = sugerirTramoReta(3529.66)!;
    expect(r.tramo.cuotaMensual).toBeLessThanOrEqual(r.cuotaMensualPagada);
    expect(r.tramo.cuotaMensual).toBe(294);
  });

  it('si lo pagado es menor que la cuota del primer tramo, sugiere el primero', () => {
    const r = sugerirTramoReta(12 * 100)!; // 100 €/mes < 230
    expect(r.indice).toBe(0);
  });

  it('valores muy altos caen en el último tramo', () => {
    const r = sugerirTramoReta(12 * 530)!;
    expect(r.indice).toBe(TRAMOS_RETA_2024.length - 1);
  });
});

describe('prefill nómina', () => {
  const d = decl({
    trabajo: {
      retribucionesDinerarias: 133350.85,
      retenciones: 47545,
      cotizacionesSS: 3665,
      contribucionesPPEmpresa: 1862.16,
      valoracionEspecie: 2549.81,
      ingresosACuentaEspecie: 907.51,
      empleador: { nif: 'A82009812', nombre: 'Orange' },
    } as any,
  });

  it('sugiere valores desde el XML', () => {
    const f = sugerenciasNomina([d])!;
    expect(f.brutoAnual).toBeCloseTo(133350.85, 2);
    expect(f.nifEmpresa).toBe('A82009812');
    expect(f.numPagas).toBe(14);
    expect(f.irpfPorcentaje).toBeGreaterThan(35);
    expect(f.ppEmpresa).toBe(true);
    expect(f.beneficiosEspecie).toBe(true);
  });

  it('construye un payload Nomina válido (personalDataId 0, activa, distribución)', () => {
    const f = sugerenciasNomina([d])!;
    const p = construirNominaPrefill(f);
    expect(p.personalDataId).toBe(0);
    expect(p.activa).toBe(true);
    expect(p.salarioBrutoAnual).toBeCloseTo(133350.85, 2);
    expect(p.distribucion.meses).toBe(14);
    expect(p.reglaCobroDia).toEqual({ tipo: 'fijo', dia: 25 });
    expect(p.retencion.irpfPorcentaje).toBeGreaterThan(0);
    expect(Array.isArray(p.variables)).toBe(true);
  });
});

describe('prefill autónomo', () => {
  const d = decl({
    actividadEconomica: {
      tipo: 'A05',
      iae: '724',
      modalidad: 'simplificada',
      ingresosExplotacion: 16259.71,
      totalIngresos: 16259.71,
      gastosSS: 3529.66,
      totalGastos: 3728,
      rendimientoNeto: 11905,
      retenciones: 2439,
    } as any,
  });

  it('sugiere IAE, modalidad y tramo RETA', () => {
    const a = sugerenciasAutonomo([d])!;
    expect(a.form.iae).toBe('724');
    expect(a.form.modalidad).toBe('simplificada');
    expect(a.sugerenciaReta?.tramo.cuotaMensual).toBe(294);
    expect(a.form.cuotaMensual).toBe(294);
  });

  it('construye un payload Autonomo válido', () => {
    const a = sugerenciasAutonomo([d])!;
    const p = construirAutonomoPrefill(a.form);
    expect(p.personalDataId).toBe(0);
    expect(p.activo).toBe(true);
    expect(p.epigrafeIAE).toBe('724');
    expect(p.modalidad).toBe('simplificada');
    expect(p.cuotaAutonomos).toBe(294);
    expect(p.cuentaCobro).toBe(0);
  });
});
