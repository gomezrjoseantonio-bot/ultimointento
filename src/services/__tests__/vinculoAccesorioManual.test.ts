/**
 * Alta MANUAL de vínculo de accesorio (parking/trastero que se alquila junto a un
 * piso). El store y su consumo ya existían; esto cubre el alta a mano desde el
 * contrato, que antes no existía (solo la creaba el import).
 */
import { initDB } from '../db';
import { crearVinculoAccesorioManual, getCandidatosAccesorio } from '../vinculoAccesorioService';

async function seedProperty(alias: string): Promise<number> {
  const db = await initDB();
  const id = await db.add('properties', {
    alias, address: `Calle ${alias}`, state: 'activo', transmissionRegime: 'usada',
    documents: [], acquisitionCosts: { price: 100000 },
  } as any);
  return Number(id);
}
async function vinculos(): Promise<any[]> {
  return (await (await initDB()).getAll('vinculosAccesorio')) as any[];
}
async function limpiar() {
  const db = await initDB();
  await Promise.all([db.clear('properties'), db.clear('vinculosAccesorio')]);
}

describe('vínculo de accesorio · alta manual desde el contrato', () => {
  beforeEach(limpiar);

  it('crea el vínculo con estado activo y origen manual', async () => {
    const piso = await seedProperty('Sant Joan');
    const parking = await seedProperty('Vic 178');
    await crearVinculoAccesorioManual({
      inmueblePrincipalId: piso, inmuebleAccesorioId: parking,
      ejercicio: 2026, fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
    });
    const vs = await vinculos();
    expect(vs).toHaveLength(1);
    expect(vs[0].inmueblePrincipalId).toBe(piso);
    expect(vs[0].inmuebleAccesorioId).toBe(parking);
    expect(vs[0].estado).toBe('activo');
    expect(vs[0].origenCreacion).toBe('manual');
  });

  it('idempotente: mismo (principal, accesorio, ejercicio) no duplica, reactiva', async () => {
    const piso = await seedProperty('Sant Joan');
    const parking = await seedProperty('Vic 178');
    const datos = { inmueblePrincipalId: piso, inmuebleAccesorioId: parking, ejercicio: 2026, fechaInicio: '2026-01-01' };
    await crearVinculoAccesorioManual(datos);
    await crearVinculoAccesorioManual({ ...datos, fechaFin: '2026-06-30' }); // segunda vez
    const vs = await vinculos();
    expect(vs).toHaveLength(1);
    expect(vs[0].fechaFin).toBe('2026-06-30');
    expect(vs[0].estado).toBe('activo');
  });

  it('rechaza vincular un inmueble consigo mismo', async () => {
    const piso = await seedProperty('Sant Joan');
    await expect(
      crearVinculoAccesorioManual({ inmueblePrincipalId: piso, inmuebleAccesorioId: piso, ejercicio: 2026, fechaInicio: '2026-01-01' }),
    ).rejects.toThrow();
  });

  it('los candidatos son los demás inmuebles, nunca el principal', async () => {
    const piso = await seedProperty('Sant Joan');
    const parking = await seedProperty('Vic 178');
    const otro = await seedProperty('Tenderina');
    const cand = await getCandidatosAccesorio(piso);
    const ids = cand.map((c) => c.id).sort();
    expect(ids).toEqual([parking, otro].sort());
    expect(ids).not.toContain(piso);
  });
});
