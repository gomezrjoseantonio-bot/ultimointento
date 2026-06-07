/**
 * Onboarding día 0 · C6 · plantilla de préstamos (parser + creación + vínculo).
 *
 * Cubre (§5 · C6):
 *   · parser lee la plantilla generada
 *   · fila válida crea préstamo (createPrestamo · genera su cuadro)
 *   · fila con inmueble (alias/RC) → setea estructuraCompra.prestamoVinculadoId
 *     y cuenta el vínculo (cierra el pendiente del semáforo)
 *   · fila con IBAN no existente → revisión (inválida)
 */
import * as fs from 'fs';
import * as path from 'path';

const mockAccounts = [{ id: 1, iban: 'ES7620770024003102575766', alias: 'Principal' }];
const mockProperties: Array<Record<string, unknown>> = [
  { id: 10, alias: 'Piso Centro', cadastralReference: 'RC1', estructuraCompra: { importeFinanciado: 80000 } },
];
const mockPuts: Array<Record<string, unknown>> = [];

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) => (store === 'accounts' ? mockAccounts : store === 'properties' ? mockProperties : []),
    put: async (store: string, value: Record<string, unknown>) => {
      if (store === 'properties') mockPuts.push(value);
    },
  }),
}));
jest.mock('../prestamosService', () => ({
  __esModule: true,
  prestamosService: { createPrestamo: jest.fn() },
}));

import { parsePrestamosTemplateXlsx } from '../prestamosTemplateParserService';
import { revisarRow, crearPrestamosDesdeRows } from '../prestamosImportCreationService';
import { prestamosService } from '../prestamosService';

const mockCreatePrestamo = prestamosService.createPrestamo as jest.Mock;

function loadTemplate(): File {
  const p = path.join(process.cwd(), 'public', 'templates', 'plantilla-prestamos-atlas.xlsx');
  const buf = fs.readFileSync(p);
  return { arrayBuffer: async () => new Uint8Array(buf) } as unknown as File;
}

beforeEach(() => {
  mockPuts.length = 0;
  mockCreatePrestamo.mockReset();
  mockCreatePrestamo.mockImplementation(async (data: Record<string, unknown>) => ({ id: 'prest_1', ...data }));
  mockProperties[0].estructuraCompra = { importeFinanciado: 80000 };
});

it('parser lee la plantilla generada', async () => {
  const rows = await parsePrestamosTemplateXlsx(loadTemplate());
  expect(rows).toHaveLength(1);
  expect(rows[0].nombre).toBe('Hipoteca Piso Centro');
  expect(rows[0].cuentaRef).toBe('ES7620770024003102575766');
  expect(rows[0].principalInicial).toBe(80000);
  expect(rows[0].tipo).toBe('FIJO');
});

it('fila válida crea préstamo y vincula el inmueble (cierra el pendiente)', async () => {
  const rows = await parsePrestamosTemplateXlsx(loadTemplate());
  const res = await crearPrestamosDesdeRows(rows);

  expect(res.creados).toBe(1);
  expect(res.vinculados).toBe(1);
  expect(mockCreatePrestamo).toHaveBeenCalledTimes(1);

  // El préstamo se crea como FIJO/vivo (genera cuadro) y con la cuenta resuelta.
  const data = mockCreatePrestamo.mock.calls[0][0] as Record<string, unknown>;
  expect(data.estado).toBe('vivo');
  expect(data.cuentaCargoId).toBe('1');
  expect(data.tipoNominalAnualFijo).toBe(2.5);

  // La Property queda con el préstamo vinculado.
  const actualizada = mockPuts[0] as { estructuraCompra: { prestamoVinculadoId: string } };
  expect(actualizada.estructuraCompra.prestamoVinculadoId).toBe('prest_1');
});

it('fila con IBAN no existente → revisión inválida', () => {
  const row = {
    filaOriginal: 2,
    nombre: 'Hipoteca X',
    inmuebleRef: null,
    cuentaRef: 'ES0000000000000000000000',
    principalInicial: 50000,
    principalVivo: 50000,
    tin: 2,
    plazoMeses: 240,
    diaCargo: 1,
    fechaPrimerCargo: '2022-01-01',
    tipo: 'FIJO' as const,
  };
  expect(revisarRow(row, mockAccounts as never).valido).toBe(false);
});
