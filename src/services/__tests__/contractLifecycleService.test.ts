// Fase F · ciclo de vida del contrato (Alquileres). Verifica finalizar /
// reactivar / cambiar renta / renovar sobre IndexedDB (fake), y el guardián de
// `updateContract` que evita duplicar entradas de `historicoRentas`.
import 'fake-indexeddb/auto';
import { saveContract, getContract, updateContract } from '../contractService';
import {
  finalizarContrato,
  reactivarContrato,
  cambiarRentaContrato,
  renovarContrato,
} from '../contractLifecycleService';
import type { Contract } from '../db';

const base = (over: Partial<Contract> = {}): Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Real', apellidos: 'Inquilino', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2027-01-01',
    rentaMensual: 1000,
    diaPago: 1,
    indexacion: 'none',
    fianzaMeses: 1,
    fianzaImporte: 1000,
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

describe('finalizarContrato', () => {
  it('pasa a finalizado, fija fechaFin=fechaCierre y registra motivo, conservando histórico', async () => {
    const id = await saveContract(base({ historicoRentas: [{ fechaDesde: '2025-01-01', importe: 1000, origen: 'firma_inicial' }] }));
    await finalizarContrato(id, {
      fechaCierre: '2026-03-31',
      motivoFin: 'cambio_ciudad',
      detalleMotivoFin: 'Se muda',
      valoracion: 4,
      volveriaAAlquilar: 'si',
      notasCasero: 'Buen inquilino',
      fianzaDevuelta: 1000,
    });
    const c = await getContract(id);
    expect(c?.estadoContrato).toBe('finalizado');
    expect(c?.fechaFin).toBe('2026-03-31');
    expect(c?.fechaCierre).toBe('2026-03-31');
    expect(c?.motivoFin).toBe('cambio_ciudad');
    expect(c?.valoracion).toBe(4);
    expect(c?.volveriaAAlquilar).toBe('si');
    expect(c?.notasCasero).toBe('Buen inquilino');
    expect(c?.fianzaDevuelta).toBe(1000);
    // El histórico de rentas se conserva intacto (no se toca).
    expect(c?.historicoRentas).toEqual([{ fechaDesde: '2025-01-01', importe: 1000, origen: 'firma_inicial' }]);
  });

  it('sin fechaCierre usa hoy y no exige motivo', async () => {
    const id = await saveContract(base());
    await finalizarContrato(id);
    const c = await getContract(id);
    expect(c?.estadoContrato).toBe('finalizado');
    expect(c?.fechaFin).toBe(c?.fechaCierre);
    expect(typeof c?.fechaCierre).toBe('string');
  });
});

describe('reactivarContrato', () => {
  it('vuelve a activo, restablece fechaFin indefinida y limpia datos de salida', async () => {
    const id = await saveContract(base());
    await finalizarContrato(id, { fechaCierre: '2026-03-31', motivoFin: 'fin_natural' });
    await reactivarContrato(id);
    const c = await getContract(id);
    expect(c?.estadoContrato).toBe('activo');
    expect(c?.fechaFin).toBe('2099-12-31');
    expect(c?.fechaCierre).toBeUndefined();
    expect(c?.motivoFin).toBeUndefined();
  });

  it('acepta una nueva fecha fin explícita', async () => {
    const id = await saveContract(base({ estadoContrato: 'finalizado', fechaFin: '2026-01-01' }));
    await reactivarContrato(id, { nuevaFechaFin: '2028-06-30' });
    const c = await getContract(id);
    expect(c?.estadoContrato).toBe('activo');
    expect(c?.fechaFin).toBe('2028-06-30');
  });
});

describe('cambiarRentaContrato', () => {
  it('apenda UNA entrada con el origen indicado y sincroniza rentaMensual (sin duplicar)', async () => {
    const id = await saveContract(base({ rentaMensual: 1000, historicoRentas: [{ fechaDesde: '2025-01-01', importe: 1000, origen: 'firma_inicial' }] }));
    await cambiarRentaContrato(id, { nuevaRenta: 1100, fechaDesde: '2026-06-01', origen: 'renegociacion', nota: 'subida' });
    const c = await getContract(id);
    expect(c?.rentaMensual).toBe(1100);
    expect(c?.historicoRentas).toHaveLength(2); // NO 3 · sin auto-append duplicado
    expect(c?.historicoRentas?.[1]).toEqual({ fechaDesde: '2026-06-01', importe: 1100, origen: 'renegociacion', nota: 'subida' });
    // rentaMensual = importe de la última entrada (invariante).
    expect(c?.rentaMensual).toBe(c?.historicoRentas?.[c.historicoRentas.length - 1].importe);
  });

  it('parte de histórico vacío correctamente', async () => {
    const id = await saveContract(base({ rentaMensual: 900, historicoRentas: undefined }));
    await cambiarRentaContrato(id, { nuevaRenta: 950 });
    const c = await getContract(id);
    expect(c?.historicoRentas).toHaveLength(1);
    expect(c?.historicoRentas?.[0].origen).toBe('manual');
    expect(c?.rentaMensual).toBe(950);
  });
});

describe('renovarContrato', () => {
  it('extiende fechaFin sin cambiar renta → sin entrada de histórico', async () => {
    const id = await saveContract(base({ rentaMensual: 1000, fechaFin: '2027-01-01' }));
    await renovarContrato(id, { nuevaFechaFin: '2029-01-01' });
    const c = await getContract(id);
    expect(c?.fechaFin).toBe('2029-01-01');
    expect(c?.estadoContrato).toBe('activo');
    expect(c?.rentaMensual).toBe(1000);
    expect(c?.historicoRentas ?? []).toHaveLength(0);
  });

  it('con nueva renta → apenda entrada renegociacion y sincroniza rentaMensual', async () => {
    const id = await saveContract(base({ rentaMensual: 1000, fechaFin: '2027-01-01' }));
    await renovarContrato(id, { nuevaFechaFin: '2029-01-01', nuevaRenta: 1080, fechaDesdeRenta: '2027-01-01' });
    const c = await getContract(id);
    expect(c?.fechaFin).toBe('2029-01-01');
    expect(c?.rentaMensual).toBe(1080);
    expect(c?.historicoRentas).toHaveLength(1);
    expect(c?.historicoRentas?.[0]).toEqual({ fechaDesde: '2027-01-01', importe: 1080, origen: 'renegociacion' });
  });

  it('renta igual a la actual → no apenda entrada', async () => {
    const id = await saveContract(base({ rentaMensual: 1000 }));
    await renovarContrato(id, { nuevaFechaFin: '2029-01-01', nuevaRenta: 1000 });
    const c = await getContract(id);
    expect(c?.historicoRentas ?? []).toHaveLength(0);
  });
});

describe('updateContract · guardián de historicoRentas', () => {
  it('si el llamante pasa historicoRentas Y rentaMensual, NO auto-añade entrada extra', async () => {
    const id = await saveContract(base({ rentaMensual: 1000 }));
    await updateContract(id, {
      rentaMensual: 1200,
      historicoRentas: [{ fechaDesde: '2026-01-01', importe: 1200, origen: 'renegociacion' }],
    });
    const c = await getContract(id);
    expect(c?.historicoRentas).toHaveLength(1);
    expect(c?.historicoRentas?.[0].origen).toBe('renegociacion');
  });

  it('si solo pasa rentaMensual, mantiene el auto-append manual (compat)', async () => {
    const id = await saveContract(base({ rentaMensual: 1000, historicoRentas: [] }));
    await updateContract(id, { rentaMensual: 1300 });
    const c = await getContract(id);
    expect(c?.historicoRentas).toHaveLength(1);
    expect(c?.historicoRentas?.[0]).toMatchObject({ importe: 1300, origen: 'manual' });
  });
});
