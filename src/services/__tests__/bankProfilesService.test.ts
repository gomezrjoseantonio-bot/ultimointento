// TAREA 17 follow-up · Tests for bankProfilesService.getBankInfoFromIBAN +
// getBankKeyFromSpanishEntityCode.
//
// Locks in the regressions added during the T17 hotfix series:
//   - PR #1164: expand the Spanish entity-code map to cover the 9 banks in
//     bank-profiles.json (Abanca / Unicaja / Openbank previously missing).
//   - PR #1165: validate IBAN-like prefix `^[A-Z]{2}\d{2}` so non-IBAN inputs
//     (Spanish CCC, arbitrary strings) do NOT produce a soft country hint.
//   - PR #1166 (this commit): expose the entity-code map via
//     getBankKeyFromSpanishEntityCode for direct lookups by `banco.code`.
import { bankProfilesService } from '../bankProfilesService';

describe('bankProfilesService.getBankInfoFromIBAN', () => {
  it('resolves Spanish IBAN to bankKey for each entity code in the canonical map', () => {
    expect(bankProfilesService.getBankInfoFromIBAN('ES4720800000000000000000')?.bankKey).toBe('ABANCA');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4701820000000000000000')?.bankKey).toBe('BBVA');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4700490000000000000000')?.bankKey).toBe('Santander');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4721030000000000000000')?.bankKey).toBe('Unicaja');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4700810000000000000000')?.bankKey).toBe('Sabadell');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4701280000000000000000')?.bankKey).toBe('Bankinter');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4714650000000000000000')?.bankKey).toBe('ING');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4700730000000000000000')?.bankKey).toBe('Openbank');
    expect(bankProfilesService.getBankInfoFromIBAN('ES4721000000000000000000')?.bankKey).toBe('CaixaBank');
  });

  it('returns soft country-hint (no bankKey) for foreign IBANs (Revolut LT/IE)', () => {
    const lt = bankProfilesService.getBankInfoFromIBAN('LT123456789012345678');
    expect(lt).toEqual(expect.objectContaining({ bankCode: 'LT' }));
    expect(lt?.bankKey).toBeUndefined();

    const ie = bankProfilesService.getBankInfoFromIBAN('IE12BOFI90001234567890');
    expect(ie?.bankCode).toBe('IE');
    expect(ie?.bankKey).toBeUndefined();
  });

  it('returns null for non-IBAN inputs (PR #1165 regression)', () => {
    // Spanish CCC (account number without country prefix) — should NOT yield
    // a hint, regardless of length.
    expect(bankProfilesService.getBankInfoFromIBAN('1465 0100 9917 13720331')).toBeNull();
    expect(bankProfilesService.getBankInfoFromIBAN('14650100991713720331')).toBeNull();

    // Arbitrary text
    expect(bankProfilesService.getBankInfoFromIBAN('INVALID')).toBeNull();
    expect(bankProfilesService.getBankInfoFromIBAN('hello world')).toBeNull();

    // Empty / undefined-ish
    expect(bankProfilesService.getBankInfoFromIBAN('')).toBeNull();

    // Almost-valid: country letters but no checksum digits
    expect(bankProfilesService.getBankInfoFromIBAN('ESxx0081...')).toBeNull();
  });

  it('returns bankCode without bankKey for an unrecognised Spanish entity code', () => {
    // Hypothetical ES IBAN with an entity code not in the canonical map.
    const result = bankProfilesService.getBankInfoFromIBAN('ES4799990000000000000000');
    expect(result?.bankCode).toBe('9999');
    expect(result?.bankKey).toBeUndefined();
  });
});

describe('bankProfilesService.getBankKeyFromSpanishEntityCode', () => {
  it('resolves the 4-digit entity code directly without IBAN parsing', () => {
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('0081')).toBe('Sabadell');
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('2080')).toBe('ABANCA');
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('1465')).toBe('ING');
  });

  it('returns null for unknown / malformed codes', () => {
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('9999')).toBeNull();
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('008')).toBeNull(); // too short
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('00811')).toBeNull(); // too long
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('ABCD')).toBeNull(); // non-numeric
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('')).toBeNull();
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode(undefined)).toBeNull();
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode(null)).toBeNull();
  });

  it('trims whitespace before validating (preserves the previous .trim() semantics)', () => {
    // Real-world IndexedDB values can carry leading/trailing whitespace from
    // user input or import flows. The pre-refactor `banco.code` fallback did
    // `.trim()` outside the helper; the helper now does it internally.
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode(' 0081')).toBe('Sabadell');
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('0081 ')).toBe('Sabadell');
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('  2080  ')).toBe('ABANCA');
    // Whitespace-only stays null.
    expect(bankProfilesService.getBankKeyFromSpanishEntityCode('   ')).toBeNull();
  });
});
