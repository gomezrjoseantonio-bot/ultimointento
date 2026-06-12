/**
 * Onboarding día 0 · C6 / FIX PUNTO 7 · plantilla de inversiones (parser + creación).
 *
 * Cubre (§3 · C6):
 *   · la plantilla espejo de las 6 familias parsea cada tipo correctamente
 *   · una plantilla vieja de 7 columnas sigue funcionando (retrocompatible)
 *   · cada fila válida crea posición (inversionesService) + valoración inicial
 *   · préstamo-activo → store de inversiones (tipo 'prestamo_p2p') · NUNCA al
 *     store de préstamos-deuda (P4)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

jest.mock('../inversionesService', () => ({
  __esModule: true,
  inversionesService: { createPosicion: jest.fn() },
}));
jest.mock('../valoracionesService', () => ({
  __esModule: true,
  upsertByDate: jest.fn(),
}));

import { parseInversionesTemplateXlsx } from '../inversionesTemplateParserService';
import { crearInversionesDesdeRows } from '../inversionesImportCreationService';
import { inversionesService } from '../inversionesService';
import { upsertByDate } from '../valoracionesService';

const mockCreatePosicion = inversionesService.createPosicion as jest.Mock;
const mockUpsertByDate = upsertByDate as unknown as jest.Mock;

function toFile(buf: Buffer): File {
  return { arrayBuffer: async () => new Uint8Array(buf) } as unknown as File;
}

function loadTemplate(): File {
  const p = path.join(process.cwd(), 'public', 'templates', 'plantilla-inversiones-atlas.xlsx');
  return toFile(fs.readFileSync(p));
}

/** Plantilla VIEJA de 7 columnas (anterior al FIX) · debe seguir parseando. */
function oldFormatFile(): File {
  const aoa = [
    ['Tipo (fondo/accion/etf/crypto/plan_pensiones/deposito/otro)', 'Entidad', 'Producto', 'Unidades', 'Coste adquisición €', 'Fecha compra', 'Valor de hoy €'],
    ['fondo', 'Indexa Capital', 'Indexa RV Mixta', 120, 10000, '10/03/2022', 12500],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atlas');
  return toFile(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

beforeEach(() => {
  mockCreatePosicion.mockReset();
  mockUpsertByDate.mockReset();
  let next = 50;
  mockCreatePosicion.mockImplementation(async () => ++next);
  mockUpsertByDate.mockResolvedValue(1);
});

it('parser lee la plantilla espejo con las 6 familias', async () => {
  const rows = await parseInversionesTemplateXlsx(loadTemplate());
  const familias = rows.map((r) => r.tipo);
  expect(familias).toEqual(
    expect.arrayContaining([
      'plan_pensiones',
      'fondo',
      'accion_etf_reit',
      'prestamo_activo',
      'deposito_cuenta',
      'crypto',
    ]),
  );
  // Campos propios opcionales se leen (participación con % atribución · depósito con TAE/plazo).
  const participacion = rows.find((r) => r.producto === 'Participación CB');
  expect(participacion?.porcentajeAtribucion).toBe(33.34);
  const deposito = rows.find((r) => r.tipo === 'deposito_cuenta');
  expect(deposito?.tae).toBe(3.2);
  expect(deposito?.plazoMeses).toBe(12);
  const fondo = rows.find((r) => r.tipo === 'fondo');
  expect(fondo?.isin).toBe('IE00B4L5Y983');
});

it('crea cada familia con su TipoPosicion canónico', async () => {
  const rows = await parseInversionesTemplateXlsx(loadTemplate());
  const res = await crearInversionesDesdeRows(rows);

  expect(res.creadas).toBe(rows.length);
  expect(mockCreatePosicion).toHaveBeenCalledTimes(rows.length);

  const tipos = mockCreatePosicion.mock.calls.map((c) => (c[0] as Record<string, unknown>).tipo);
  expect(tipos).toEqual(
    expect.arrayContaining(['plan_empleo', 'fondo_inversion', 'etf', 'accion', 'prestamo_p2p', 'deposito_plazo', 'crypto']),
  );
});

it('préstamo-activo va al store de inversiones · nunca a préstamos-deuda (P4)', async () => {
  const rows = await parseInversionesTemplateXlsx(loadTemplate());
  await crearInversionesDesdeRows(rows.filter((r) => r.tipo === 'prestamo_activo'));

  expect(mockCreatePosicion).toHaveBeenCalledTimes(1);
  const pos = mockCreatePosicion.mock.calls[0][0] as Record<string, unknown>;
  expect(pos.tipo).toBe('prestamo_p2p');
  // La valoración usa el store polimórfico como 'inversion' (no 'deposito').
  const val = mockUpsertByDate.mock.calls[0][0] as Record<string, unknown>;
  expect(val.tipoActivo).toBe('inversion');
});

it('plantilla vieja de 7 columnas sigue funcionando (retrocompatible)', async () => {
  const rows = await parseInversionesTemplateXlsx(oldFormatFile());
  expect(rows).toHaveLength(1);
  expect(rows[0].tipo).toBe('fondo');
  expect(rows[0].producto).toBe('Indexa RV Mixta');
  expect(rows[0].valorHoy).toBe(12500);

  const res = await crearInversionesDesdeRows(rows);
  expect(res.creadas).toBe(1);
  const pos = mockCreatePosicion.mock.calls[0][0] as Record<string, unknown>;
  expect(pos.tipo).toBe('fondo_inversion');
  expect(pos.total_aportado).toBe(10000);
});
