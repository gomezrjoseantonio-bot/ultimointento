// Wizard import XML V2 · paso 10 · planificación multi-ejercicio.
import { planificarImportacion } from '../useWizardImportState';
import { OPCIONES_DEFAULT, type OpcionesDistribucion } from '../../../../types/opcionesDistribucion';
import type { DeclaracionCompleta } from '../../../../types/declaracionCompleta';

function decl(ejercicio: number): DeclaracionCompleta {
  return {
    meta: { ejercicio, tipoDeclaracion: 'D' } as any,
    declarante: {} as any,
    inmuebles: [],
    integracion: {} as any,
    resultado: {} as any,
    arrastres: {} as any,
    casillas: {},
    camposExtra: {},
  } as DeclaracionCompleta;
}

const opciones: OpcionesDistribucion = {
  ...OPCIONES_DEFAULT,
  crearNominaActiva: true,
  nominaPrefill: { personalDataId: 0 } as any,
  crearActividadAutonoma: true,
  conyugeAnadirPersonal: true,
  ibanAcciones: [{ iban: 'ES1', accion: 'crear' }],
  inmueblesPrefill: [{ refCatastral: 'RC' }],
};

describe('planificarImportacion', () => {
  it('ordena cronológicamente ascendente', () => {
    const plan = planificarImportacion([decl(2024), decl(2020), decl(2022)], OPCIONES_DEFAULT);
    expect(plan.map((p) => p.decl.meta.ejercicio)).toEqual([2020, 2022, 2024]);
    expect(plan[plan.length - 1].esUltima).toBe(true);
  });

  it('aplica los opt-in de Fase B solo en la última llamada', () => {
    const plan = planificarImportacion([decl(2023), decl(2024)], opciones);
    const primera = plan[0].opciones;
    const ultima = plan[1].opciones;

    // Primera: sin opt-in de creación de entidades.
    expect(primera.crearNominaActiva).toBe(false);
    expect(primera.crearActividadAutonoma).toBe(false);
    expect(primera.conyugeAnadirPersonal).toBe(false);
    // Pero sí IBAN + prefill inmuebles (idempotentes).
    expect(primera.ibanAcciones).toEqual(opciones.ibanAcciones);
    expect(primera.inmueblesPrefill).toEqual(opciones.inmueblesPrefill);

    // Última: opciones completas.
    expect(ultima.crearNominaActiva).toBe(true);
    expect(ultima.crearActividadAutonoma).toBe(true);
    expect(ultima.conyugeAnadirPersonal).toBe(true);
  });

  it('un solo ejercicio · esa llamada es la última con opciones completas', () => {
    const plan = planificarImportacion([decl(2024)], opciones);
    expect(plan).toHaveLength(1);
    expect(plan[0].esUltima).toBe(true);
    expect(plan[0].opciones.crearNominaActiva).toBe(true);
  });
});

// Cadena de autoliquidaciones rectificativas del mismo ejercicio.
function declChain(ejercicio: number, resultado: number, previoIngresos?: number): DeclaracionCompleta {
  return {
    meta: {
      ejercicio,
      tipoDeclaracion: 'I',
      esRectificativa: previoIngresos != null,
      ...(previoIngresos != null ? { declaracionPrevia: { ingresosPrevios: previoIngresos } } : {}),
    } as any,
    declarante: {} as any,
    inmuebles: [],
    integracion: {} as any,
    resultado: { resultadoDeclaracion: resultado } as any,
    arrastres: {} as any,
    casillas: {},
    camposExtra: {},
  } as DeclaracionCompleta;
}

describe('planificarImportacion · cadena de rectificativas (mismo ejercicio)', () => {
  const original = declChain(2024, 2077.61);
  const rect1 = declChain(2024, 1859.88, 2077.61);
  const rect2 = declChain(2024, 2899.75, 1859.88);

  it('ordena original → rect1 → rect2 aunque se suban desordenadas · gana la última', () => {
    const plan = planificarImportacion([rect2, original, rect1], OPCIONES_DEFAULT);
    expect(plan.map((p) => p.decl.resultado!.resultadoDeclaracion)).toEqual([2077.61, 1859.88, 2899.75]);
    // La última procesada (la que deja su snapshot activo) es la rectificativa final.
    expect(plan[plan.length - 1].decl.resultado!.resultadoDeclaracion).toBe(2899.75);
    expect(plan[plan.length - 1].esUltima).toBe(true);
  });

  it('varios años · cada año ordena su cadena y los años van ascendentes', () => {
    const otroAño = declChain(2023, 500);
    const plan = planificarImportacion([rect2, otroAño, original, rect1], OPCIONES_DEFAULT);
    expect(plan.map((p) => p.decl.meta.ejercicio)).toEqual([2023, 2024, 2024, 2024]);
    expect(plan[plan.length - 1].decl.resultado!.resultadoDeclaracion).toBe(2899.75);
  });
});
