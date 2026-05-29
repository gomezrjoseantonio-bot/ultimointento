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
