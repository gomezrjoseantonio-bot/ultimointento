// Wizard import XML V2 · pasos 4·5 · helpers de detección.
import { detectarProveedores, detectarPlanesXml } from '../deteccion';
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

function inmueble(parcial: any): any {
  return { refCatastral: 'RC', direccion: 'Calle Falsa 1', arrendamientos: [], mejorasEjercicio: [], proveedores: [], ...parcial };
}

describe('detectarProveedores', () => {
  it('agrega NIFs de mejoras, proveedores e importes; ordena por total desc', () => {
    const d = decl({
      inmuebles: [
        inmueble({
          mejorasEjercicio: [{ importe: 100, nifProveedor: 'B1' }],
          proveedores: [{ nif: 'B2', concepto: 'reparacion', importe: 500 }],
          arrendamientos: [{ nifArrendatarios: [], proveedores: [{ nif: 'B1', concepto: 'servicios', importe: 50 }] }],
        }),
      ],
    });
    const provs = detectarProveedores([d]);
    expect(provs).toHaveLength(2);
    expect(provs[0].nif).toBe('B2'); // mayor total primero
    const b1 = provs.find((p) => p.nif === 'B1')!;
    expect(b1.total).toBe(150); // 100 mejora + 50 servicios
  });

  it('ignora accesorios y NIFs vacíos o importe 0', () => {
    const d = decl({
      inmuebles: [
        inmueble({ esAccesorioDe: 'RC-PADRE', proveedores: [{ nif: 'X', concepto: 'reparacion', importe: 999 }] }),
        inmueble({ proveedores: [{ nif: '', concepto: 'reparacion', importe: 10 }, { nif: 'B3', concepto: 'gestion', importe: 0 }] }),
      ],
    });
    expect(detectarProveedores([d])).toHaveLength(0);
  });
});

describe('detectarPlanesXml', () => {
  it('agrupa por NIF empleador y suma por año', () => {
    const planes = detectarPlanesXml([
      decl({ meta: { ejercicio: 2023, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 1420, contribucionesEmpresa: 2180, nifEmpleador: 'A82009812', totalConDerechoReduccion: 3600 } as any }),
      decl({ meta: { ejercicio: 2024, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 1396.68, contribucionesEmpresa: 1862.16, nifEmpleador: 'A82009812', totalConDerechoReduccion: 3258.84 } as any }),
    ]);
    expect(planes).toHaveLength(1);
    expect(planes[0].nifEmpleador).toBe('A82009812');
    expect(planes[0].porAnio).toHaveLength(2);
    expect(planes[0].totalTrabajador).toBeCloseTo(2816.68, 2);
    expect(planes[0].totalEmpresa).toBeCloseTo(4042.16, 2);
  });

  it('omite declaraciones sin aportaciones', () => {
    expect(detectarPlanesXml([decl({})])).toHaveLength(0);
    expect(detectarPlanesXml([decl({ planPensiones: { aportacionesTrabajador: 0, contribucionesEmpresa: 0, totalConDerechoReduccion: 0 } as any })])).toHaveLength(0);
  });

  it('H1 · unifica en 1 card aunque el NIF empleador solo aparezca en algunos años (backfill)', () => {
    const planes = detectarPlanesXml([
      // 2020-2022 sin NIF empleador (XML no lo trae)
      decl({ meta: { ejercicio: 2020, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 1203.36, contribucionesEmpresa: 1604.52, totalConDerechoReduccion: 2807.88 } as any }),
      decl({ meta: { ejercicio: 2022, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 1281.6, contribucionesEmpresa: 1708.8, totalConDerechoReduccion: 2990.4 } as any }),
      // 2024 con NIF + nombre empleador
      decl({ meta: { ejercicio: 2024, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 1396.68, contribucionesEmpresa: 1862.16, nifEmpleador: 'A82009812', nombreEmpleador: 'ORANGE ESPAGNE SA', totalConDerechoReduccion: 3258.84 } as any }),
    ]);
    expect(planes).toHaveLength(1); // 1 sola card
    expect(planes[0].porAnio).toHaveLength(3); // los 3 años
    expect(planes[0].nifEmpleador).toBe('A82009812'); // backfill
    expect(planes[0].nombreEmpleador).toBe('ORANGE ESPAGNE SA');
  });

  it('H1 · separa en varias cards si hay NIF de empleador distintos', () => {
    const planes = detectarPlanesXml([
      decl({ meta: { ejercicio: 2023, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 100, contribucionesEmpresa: 200, nifEmpleador: 'A11111111', totalConDerechoReduccion: 300 } as any }),
      decl({ meta: { ejercicio: 2024, tipoDeclaracion: 'D' } as any, planPensiones: { aportacionesTrabajador: 100, contribucionesEmpresa: 200, nifEmpleador: 'B22222222', totalConDerechoReduccion: 300 } as any }),
    ]);
    expect(planes).toHaveLength(2);
  });
});
