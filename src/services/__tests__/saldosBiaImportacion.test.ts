/**
 * Saldos negativos BIA (base del ahorro, art. 49 LIRPF) · cableado del import al
 * store canónico `perdidasPatrimonialesAhorro`.
 *
 * Antes el import solo los escribía en `ejerciciosFiscalesCoord` (display), que la
 * compensación real del IRPF no lee. Aquí se comprueba que el import los vuelca al
 * store del motor (`tipoOrigen: 'importado'`), idempotente y order-independiente.
 *
 * Caso real (crypto): origen 2022 = 1.418,35 €; aplica 73,36 € en 2024 → 1.344,99 €;
 * aplica el resto en 2025 (venta Tenderina 48) → 0. Origen 2023 = 27.764,23 €,
 * consumido íntegro en 2025.
 */
import { initDB } from '../db';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

type Perdida = { tipo: 'ahorro' | 'general'; importeInicial: number; importeAplicado: number; importePendiente: number; añoOrigen: number };

function decl(ejercicio: number, perdidas: Perdida[]): DeclaracionCompleta {
  return {
    meta: { ejercicio, modelo: '100', fuenteImportacion: 'xml', numeroJustificante: '',
      csv: '', referencia: '', fechaPresentacion: '', esComplementaria: false, esRectificativa: false, tipoDeclaracion: 'I' },
    declarante: { nif: '00000000T', nombreCompleto: 'FIXTURE', tributacion: 'individual', asignacionSocial: false, asignacionIglesia: false },
    inmuebles: [],
    integracion: { baseImponibleGeneral: 0, baseImponibleAhorro: 0, reduccionPP: 0, baseLiquidableGeneral: 0, baseLiquidableAhorro: 0, minimoPersonalEstatal: 0, minimoPersonalAutonomico: 0 },
    resultado: { cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: 0, cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: 0, deduccionesAutonomicas: 0, deduccionesEstatales: 0, cuotaAutoliquidacion: 0, totalRetencionesPagos: 0, cuotaDiferencial: 0, resultadoDeclaracion: 0 },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: perdidas },
    casillas: {}, camposExtra: {},
  } as DeclaracionCompleta;
}

// Declaraciones reales (añoOrigen = offset respecto al ejercicio):
const D2022 = () => decl(2022, [{ tipo: 'ahorro', importeInicial: 1418.35, importeAplicado: 0, importePendiente: 1418.35, añoOrigen: 0 }]);
const D2023 = () => decl(2023, [
  { tipo: 'ahorro', importeInicial: 1418.35, importeAplicado: 0, importePendiente: 1418.35, añoOrigen: 1 }, // origen 2022
  { tipo: 'ahorro', importeInicial: 27764.23, importeAplicado: 0, importePendiente: 27764.23, añoOrigen: 0 }, // origen 2023
]);
const D2024 = () => decl(2024, [
  { tipo: 'ahorro', importeInicial: 1418.35, importeAplicado: 73.36, importePendiente: 1344.99, añoOrigen: 2 }, // origen 2022
  { tipo: 'ahorro', importeInicial: 27764.23, importeAplicado: 0, importePendiente: 27764.23, añoOrigen: 1 }, // origen 2023
]);
const D2025 = () => decl(2025, [
  { tipo: 'ahorro', importeInicial: 1344.99, importeAplicado: 1344.99, importePendiente: 0, añoOrigen: 3 }, // origen 2022
  { tipo: 'ahorro', importeInicial: 27764.23, importeAplicado: 27764.23, importePendiente: 0, añoOrigen: 2 }, // origen 2023
]);

async function pendiente(origen: number): Promise<number | null> {
  const all = (await (await initDB()).getAll('perdidasPatrimonialesAhorro')) as any[];
  const r = all.find((x) => x.ejercicioOrigen === origen && x.tipoOrigen === 'importado');
  return r ? r.importePendiente : null;
}
async function limpiar() {
  const db = await initDB();
  await Promise.all([db.clear('perdidasPatrimonialesAhorro'), db.clear('ejerciciosFiscalesCoord'), db.clear('properties')]);
}

describe('saldos BIA · el import alimenta perdidasPatrimonialesAhorro', () => {
  beforeEach(limpiar);

  it('el año origen crea el saldo con caducidad +4', async () => {
    await distribuirDeclaracion(D2022(), OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(1418.35, 2);
    const all = (await (await initDB()).getAll('perdidasPatrimonialesAhorro')) as any[];
    expect(all.find((x) => x.ejercicioOrigen === 2022).ejercicioCaducidad).toBe(2026);
  });

  it('las aplicaciones de años posteriores reducen el pendiente (73,36 → 1.344,99 → 0)', async () => {
    await distribuirDeclaracion(D2022(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(D2024(), OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(1344.99, 2);
    await distribuirDeclaracion(D2025(), OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(0, 2);
  });

  it('importando toda la historia, ambos saldos quedan a 0 (consumidos en la venta 2025)', async () => {
    for (const d of [D2022(), D2023(), D2024(), D2025()]) await distribuirDeclaracion(d, OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(0, 2);
    expect(await pendiente(2023)).toBeCloseTo(0, 2);
  });

  it('order-independiente: importar 2025→2022 deja el mismo estado que 2022→2025', async () => {
    for (const d of [D2025(), D2024(), D2023(), D2022()]) await distribuirDeclaracion(d, OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(0, 2);
    expect(await pendiente(2023)).toBeCloseTo(0, 2);
  });

  it('idempotencia: reimportar 2024 no cambia el pendiente', async () => {
    await distribuirDeclaracion(D2022(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(D2024(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(D2024(), OPCIONES_DEFAULT);
    expect(await pendiente(2022)).toBeCloseTo(1344.99, 2);
  });
});
