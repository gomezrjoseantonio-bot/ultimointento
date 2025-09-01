import { BankProfile, BankProfilesData, BankDetectionResult } from '../types/bankProfiles';

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