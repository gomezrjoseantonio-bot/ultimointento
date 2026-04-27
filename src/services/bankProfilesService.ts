import { BankProfile, BankProfilesData, BankDetectionResult } from '../types/bankProfiles';

// Spanish bank entity-code map (the 4-digit code used as positions 5–8 of a
// Spanish IBAN, or stored separately as `account.banco.code`). Updated
// 2026-04-27 after user reports: first round added Abanca/Unicaja/Openbank,
// second round added Revolut Bank UAB · Sucursal en España (code 1583).
// Source of truth for the entities in public/assets/bank-profiles.json that
// have a Spanish IBAN.
const SPANISH_ENTITY_CODE_MAP: Record<string, string> = {
  '2080': 'ABANCA',
  '0182': 'BBVA',
  '0049': 'Santander',
  '2103': 'Unicaja',
  '0081': 'Sabadell',
  '0128': 'Bankinter',
  '1465': 'ING',
  '0073': 'Openbank',
  '2100': 'CaixaBank',
  '1583': 'Revolut', // Revolut Bank UAB · Sucursal en España
};

class BankProfilesService {
  private profiles: BankProfile[] = [];
  private loaded = false;

  async loadProfiles(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch('/assets/bank-profiles.json');
      if (!response.ok) {
        throw new Error(`Failed to load bank profiles: ${response.status}`);
      }
      
      const data: BankProfilesData = await response.json();
      this.profiles = data.profiles || [];
      this.loaded = true;
      
      console.log(`Loaded ${this.profiles.length} bank profiles`);
    } catch (error) {
      console.error('Failed to load bank profiles:', error);
      this.profiles = [];
      this.loaded = true;
    }
  }

  getProfiles(): BankProfile[] {
    return [...this.profiles];
  }

  async detectBank(headers: string[]): Promise<BankDetectionResult | null> {
    await this.loadProfiles();
    
    if (this.profiles.length === 0) return null;

    const normalizedHeaders = headers.map(h => this.normalizeText(h));
    let bestMatch: BankDetectionResult | null = null;
    let bestScore = 0;

    for (const profile of this.profiles) {
      const score = this.calculateScore(normalizedHeaders, profile);
      
      if (score >= profile.minScore && score > bestScore) {
        // Ensure we have at least 2 matches and one must be amount
        const matches = this.getMatches(normalizedHeaders, profile);
        if (matches.length >= 2 && matches.some(m => m.type === 'amount')) {
          bestScore = score;
          bestMatch = {
            bankKey: profile.bankKey,
            bankVersion: profile.bankVersion,
            score,
            profile
          };
        }
      }
    }

    return bestMatch;
  }

  private calculateScore(headers: string[], profile: BankProfile): number {
    let score = 0;
    const headerAliases = profile.headerAliases;

    for (const header of headers) {
      // Check each field type
      for (const aliases of Object.values(headerAliases)) {
        if (aliases.some(alias => this.normalizeText(alias) === header)) {
          score++;
          break; // Only count once per header
        }
      }
    }

    return score;
  }

  private getMatches(headers: string[], profile: BankProfile): Array<{type: string, header: string}> {
    const matches: Array<{type: string, header: string}> = [];
    const headerAliases = profile.headerAliases;

    for (const header of headers) {
      for (const [fieldType, aliases] of Object.entries(headerAliases)) {
        if (aliases.some(alias => this.normalizeText(alias) === header)) {
          matches.push({ type: fieldType, header });
          break;
        }
      }
    }

    return matches;
  }

  mapHeaders(headers: string[], profile: BankProfile): Record<string, number> {
    const mapping: Record<string, number> = {};
    const normalizedHeaders = headers.map(h => this.normalizeText(h));

    for (const [fieldType, aliases] of Object.entries(profile.headerAliases)) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (aliases.some(alias => this.normalizeText(alias) === header)) {
          mapping[fieldType] = i;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Get bank logo URL by bank key or IBAN
   */
  getBankLogo(bankKey: string, iban?: string): string | null {
    // First try to find by bank key
    let profile = this.profiles.find(p => p.bankKey.toLowerCase() === bankKey.toLowerCase());
    
    // If not found, fallback to generic
    if (profile) {
      // Construct logo path from bank key
      return `/assets/bank-logos/${profile.bankKey.toLowerCase()}.svg`;
    }
    
    // Fallback to generic bank icon
    return '/assets/icons/bank-generic.svg';
  }

  /**
   * Get bank display name with enhanced formatting
   */
  getBankDisplayName(bankKey: string, iban?: string): string {
    const profile = this.profiles.find(p => p.bankKey.toLowerCase() === bankKey.toLowerCase());
    
    if (profile) {
      return profile.bankKey;
    }
    
    return bankKey;
  }

  /**
   * Enhanced IBAN formatting with bank context
   */
  formatIBANWithBankInfo(iban: string): {
    iban: string;
    maskedIban: string;
    bankKey?: string;
    logoUrl?: string;
  } {
    if (!iban || !iban.startsWith('ES')) {
      return { iban, maskedIban: iban };
    }
    
    // Try to identify bank from existing profiles by IBAN pattern matching
    let bankKey: string | undefined;
    let logoUrl: string | undefined;
    
    // Simple bank identification based on common patterns
    if (iban.includes('2100')) bankKey = 'CaixaBank';
    else if (iban.includes('0049')) bankKey = 'Santander';
    else if (iban.includes('0182')) bankKey = 'BBVA';
    else if (iban.includes('0081')) bankKey = 'Sabadell';
    
    if (bankKey) {
      logoUrl = `/assets/bank-logos/${bankKey.toLowerCase()}.svg`;
    }
    
    // Format IBAN with spaces: ES12 3456 7890 1234 5678 90
    const formattedIban = iban.replace(/(.{4})/g, '$1 ').trim();
    
    // Create masked version: ES12 **** **** **** **** 7890
    const maskedIban = `${iban.substring(0, 4)} **** **** **** **** ${iban.substring(iban.length - 4)}`;
    
    return {
      iban: formattedIban,
      maskedIban,
      bankKey,
      logoUrl: logoUrl || '/assets/icons/bank-generic.svg'
    };
  }

  /**
   * Resolve a Spanish entity code (4-digit bank code) to its bankKey directly.
   * Used by callers that already know the entity code without needing to
   * parse a full IBAN — e.g. `account.banco.code` stored independently.
   *
   * Returns null when the code is not in the canonical map.
   */
  getBankKeyFromSpanishEntityCode(code: string | undefined | null): string | null {
    const normalized = code?.trim();
    if (!normalized || !/^\d{4}$/.test(normalized)) return null;
    return SPANISH_ENTITY_CODE_MAP[normalized] ?? null;
  }

  /**
   * Get comprehensive bank information from IBAN.
   *
   * Recognises Spanish IBANs (ES + 4-digit bank code) for the 9 entities listed
   * in public/assets/bank-profiles.json. Foreign IBANs (Revolut typically uses
   * LT or IE) fall back to the bankCode without a key, so callers can still
   * apply other heuristics if available.
   */
  getBankInfoFromIBAN(iban: string): {
    bankCode: string;
    bankKey?: string;
    logoUrl?: string;
  } | null {
    if (!iban) return null;
    const upper = iban.toUpperCase();

    // Validate IBAN-like prefix `<country><checksum>` so non-IBAN inputs
    // (a Spanish CCC like "1465 0100 …" or arbitrary text) don't accidentally
    // get a country hint.
    if (!/^[A-Z]{2}\d{2}/.test(upper)) return null;

    // Non-Spanish IBANs (Revolut typically): LT (Lithuania) or IE (Ireland).
    // We don't have access to a non-ES bank-code map, so just return the
    // country prefix as a soft hint — bankProfileMatcher will use the
    // filename/content signals to discriminate.
    if (!upper.startsWith('ES')) {
      return { bankCode: upper.slice(0, 2) };
    }

    if (iban.length < 8) return null;
    const bankCode = iban.substring(4, 8);
    const bankKey = this.getBankKeyFromSpanishEntityCode(bankCode) ?? undefined;

    return {
      bankCode,
      bankKey,
      logoUrl: bankKey ? `/assets/bank-logos/${bankKey.toLowerCase()}.svg` : '/assets/icons/bank-generic.svg'
    };
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getGenericProfile(): Promise<BankProfile> {
    return {
      bankKey: 'Generic',
      bankVersion: '1.0.0',
      headerAliases: {
        date: ['fecha', 'date', 'fecha operacion', 'fecha movimiento'],
        valueDate: ['fecha valor', 'value date', 'fecha de valor'],
        amount: ['importe', 'amount', 'cantidad', 'monto', 'euros'],
        description: ['descripcion', 'description', 'concepto', 'detalle'],
        counterparty: ['contraparte', 'counterparty', 'beneficiario', 'ordenante']
      },
      noisePatterns: [
        'saldo inicial', 'saldo final', 'saldo anterior', 'saldo actual', 
        'subtotal', 'total', 'totales', 'página', 'page', 'extracto', 
        'periodo', 'desde', 'hasta', 'nº de cuenta', 'iban', 'titular', 'oficina'
      ],
      numberFormat: {
        decimal: ',',
        thousand: '.'
      },
      dateHints: ['dd/mm/yyyy', 'dd-mm-yyyy'],
      minScore: 1
    };
  }
}

export const bankProfilesService = new BankProfilesService();