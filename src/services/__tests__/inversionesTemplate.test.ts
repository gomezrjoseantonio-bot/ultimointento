/**
 * Onboarding día 0 · C6 · plantilla de inversiones (parser + creación).
 *
 * Cubre (§5 · C6): fila válida crea posición (inversionesService) + valoración
 * inicial (valoracionesService.upsertByDate).
 */
import * as fs from 'fs';
import * as path from 'path';

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

function loadTemplate(): File {
  const p = path.join(process.cwd(), 'public', 'templates', 'plantilla-inversiones-atlas.xlsx');
  const buf = fs.readFileSync(p);
  return { arrayBuffer: async () => new Uint8Array(buf) } as unknown as File;
}

beforeEach(() => {
  mockCreatePosicion.mockReset();
  mockUpsertByDate.mockReset();
  mockCreatePosicion.mockResolvedValue(55);
  mockUpsertByDate.mockResolvedValue(1);
});

it('parser lee la plantilla generada', async () => {
  const rows = await parseInversionesTemplateXlsx(loadTemplate());
  expect(rows).toHaveLength(1);
  expect(rows[0].tipo).toBe('fondo');
  expect(rows[0].producto).toBe('Indexa RV Mixta');
  expect(rows[0].valorHoy).toBe(12500);
  expect(rows[0].costeAdquisicion).toBe(10000);
});

it('fila válida crea posición + valoración inicial', async () => {
  const rows = await parseInversionesTemplateXlsx(loadTemplate());
  const res = await crearInversionesDesdeRows(rows);

  expect(res.creadas).toBe(1);
  expect(mockCreatePosicion).toHaveBeenCalledTimes(1);
  expect(mockUpsertByDate).toHaveBeenCalledTimes(1);

  const pos = mockCreatePosicion.mock.calls[0][0] as Record<string, unknown>;
  expect(pos.nombre).toBe('Indexa RV Mixta');
  expect(pos.valor_actual).toBe(12500);
  expect(pos.total_aportado).toBe(10000);

  const val = mockUpsertByDate.mock.calls[0][0] as Record<string, unknown>;
  expect(val.activoId).toBe('55');
  expect(val.tipoActivo).toBe('inversion');
  expect(val.valor).toBe(12500);
});
