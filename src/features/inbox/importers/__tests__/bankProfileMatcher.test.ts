// TAREA 17 hotfix · Tests for bankProfileMatcher.
//
// Locks in the regression: Sabadell (and other Spanish banks) exports a
// metadata block (Cuenta:, Divisa:, Titular:, Selección:) BEFORE the actual
// column-headers row. The pre-fix matcher picked the first wordy line which
// landed on "Cuenta:;ES47…" and matched 0 alias groups → confidence 0 →
// BankProfileNotDetectedError on real Sabadell files.
//
// The fix: (a) scan every candidate line (not just the first), and (b) add
// IBAN bank-code matching so an "ES47 0081…" row alone is enough to identify
// Sabadell even if the headers row is missed entirely.
import { bankProfileMatcher } from '../bankProfileMatcher';
import { bankProfilesService } from '../../../../services/bankProfilesService';
import type { BankProfile } from '../../../../types/bankProfiles';

jest.mock('../../../../services/bankProfilesService', () => ({
  bankProfilesService: {
    loadProfiles: jest.fn(),
    getProfiles: jest.fn(),
    getBankInfoFromIBAN: jest.fn(),
  },
}));

function profile(overrides: Partial<BankProfile> & { bankKey: string }): BankProfile {
  return {
    bankKey: overrides.bankKey,
    bankVersion: '2025.01.15',
    headerAliases: overrides.headerAliases ?? {
      date: ['fecha', 'f. operativa'],
      valueDate: ['fecha valor', 'f. valor'],
      amount: ['importe'],
      description: ['concepto', 'descripcion'],
      counterparty: ['contraparte', 'beneficiario'],
      balance: ['saldo'],
      reference: ['referencia 1', 'referencia 2', 'referencia'],
    },
    noisePatterns: [],
    numberFormat: { decimal: ',', thousand: '.' },
    minScore: overrides.minScore ?? 3,
  };
}

const SABADELL_PROFILE = profile({ bankKey: 'Sabadell' });
const BBVA_PROFILE = profile({ bankKey: 'BBVA' });

beforeEach(() => {
  jest.clearAllMocks();
  (bankProfilesService.loadProfiles as jest.Mock).mockResolvedValue(undefined);
  (bankProfilesService.getProfiles as jest.Mock).mockReturnValue([SABADELL_PROFILE, BBVA_PROFILE]);
  (bankProfilesService.getBankInfoFromIBAN as jest.Mock).mockImplementation((iban: string) => {
    if (iban.includes('0081')) return { bankCode: '0081', bankKey: 'Sabadell' };
    if (iban.includes('0182')) return { bankCode: '0182', bankKey: 'BBVA' };
    return null;
  });
});

describe('bankProfileMatcher.match · Sabadell layout regression', () => {
  it('detects Sabadell from a CSV that has metadata block BEFORE the real headers row', async () => {
    // Mirror of the actual Sabadell XLS export shown in the user bug report:
    // Title row, IBAN row, Divisa row, Titular row, blank, then column headers.
    const csv = [
      'Consulta de movimientos;;;;;',
      '27/04/2026 3:34:55;;;;;',
      ';;;;;',
      'Cuenta:;ES47 0081 2706 1500 0323 9635;;;;',
      'Divisa:;EUR;;;;',
      'Titular:;JOSE ANTONIO GOMEZ RAMIREZ;;;;',
      'Selección:;Desde 01/04/2026 hasta 27/04/2026;;;;',
      ';;;;;',
      'F. Operativa;Concepto;F. Valor;Importe;Saldo;Referencia 1;Referencia 2',
      '22/04/2026;GAS Visalia-Domestica Energia;22/04/2026;-11,02;1.165,54;B99340564000;MMDM202500413586',
      '20/04/2026;GAS Visalia-Domestica Energia;20/04/2026;-33,91;1.176,56;B99340564000;MMDM202600472736',
    ].join('\n');
    const file = new File([csv], '27042026_2706_0003239635.csv', { type: 'text/csv' });

    const result = await bankProfileMatcher.match(file, 'csv');

    expect(result.profile).toBe('Sabadell');
    expect(result.confidence).toBeGreaterThanOrEqual(60); // above orchestrator threshold
    // IBAN signal alone is worth 25; header signal contributes too because the
    // matcher now scans every line and finds the real headers row.
    expect(result.signals.ibanScore).toBe(25);
    expect(result.signals.headerScore).toBeGreaterThan(0);
  });

  it('detects bank from IBAN alone when no header-aliases row matches at all', async () => {
    // Pathological case: only the IBAN line carries any signal.
    const csv = [
      'Resumen mensual;;;',
      'IBAN: ES47 0081 2706 1500 0323 9635;;;',
      'Total operaciones;15;;',
      'Total ingresos;1234,56;;',
    ].join('\n');
    const file = new File([csv], 'resumen.csv', { type: 'text/csv' });

    const result = await bankProfileMatcher.match(file, 'csv');

    expect(result.profile).toBe('Sabadell');
    expect(result.signals.ibanScore).toBe(25);
    expect(result.confidence).toBeGreaterThanOrEqual(25);
  });

  it('does not falsely identify a bank when IBAN code is unknown and headers do not match', async () => {
    const csv = [
      'Algun titulo random;;',
      'Cuenta:;ES47 9999 0000 0000 0000 0000;;', // 9999 not in bank-code map
      'Movimiento;Importe;Fecha',
      'Pago;-10;2026-04-22',
    ].join('\n');
    const file = new File([csv], 'unknown.csv', { type: 'text/csv' });

    const result = await bankProfileMatcher.match(file, 'csv');

    // Both fixture profiles have similar default header aliases, so one might
    // match by header tokens — but neither should reach the 60-confidence bar
    // that the orchestrator uses to consider the detection trustworthy.
    expect(result.signals.ibanScore).toBe(0);
    expect(result.confidence).toBeLessThan(60);
  });

  it('detects bank when IBAN groups are separated by multiple spaces (real export alignment)', async () => {
    // Some exports right-align IBAN chunks for visual layout, producing 2+
    // spaces between the country checksum and the bank-code group.
    const csv = [
      'Resumen;;;',
      'Cuenta:;ES47   0081   2706   1500   0323   9635;;', // triple-space alignment
      'Movimientos;15;;',
    ].join('\n');
    const file = new File([csv], 'extracto.csv', { type: 'text/csv' });

    const result = await bankProfileMatcher.match(file, 'csv');

    expect(result.profile).toBe('Sabadell');
    expect(result.signals.ibanScore).toBe(25);
  });

  it('routes to BBVA when IBAN starts with 0182 even if filename is generic', async () => {
    const csv = [
      'Movimientos cuenta;;;',
      'Cuenta;ES36 0182 5322 0020 6120 0131;;',
      'Fecha;Concepto;Importe;Saldo',
      '2026-04-22;Recibo;100,00;1000,00',
    ].join('\n');
    const file = new File([csv], 'extracto-mes.csv', { type: 'text/csv' });

    const result = await bankProfileMatcher.match(file, 'csv');

    expect(result.profile).toBe('BBVA');
    expect(result.signals.ibanScore).toBe(25);
  });
});
