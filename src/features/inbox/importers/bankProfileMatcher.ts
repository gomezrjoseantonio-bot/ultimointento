// TAREA 17 · Bank profile matcher
//
// Detects which bank profile (from public/assets/bank-profiles.json) a statement
// file belongs to. Combines three signals into a 0-100 confidence score:
//   1. Header aliases (delegates to bankProfilesService.detectBank)
//   2. Filename hints (e.g. "sabadell-extracto.xlsx" → Sabadell)
//   3. Distinctive content tokens scanned across the first chunk of the file
//
// The orchestrator (sub-tarea 17.5) calls this before parsing. If the returned
// confidence is below 60 and the user did not pass an explicit hint, the
// orchestrator throws so the UI can offer manual bank selection.
//
// NOTE: Per spec §11, this tarea does NOT calibrate the 10 profiles against
// real archives — that is TAREA 18. The signal weights below are a sensible
// default; T18 will tune them.
import { bankProfilesService } from '../../../services/bankProfilesService';
import { BankProfile } from '../../../types/bankProfiles';

export type BankFormat = 'csv' | 'xlsx' | 'xls' | 'csb43';

export interface BankProfileMatchResult {
  profile: string | null;       // bankKey or null when no profile reaches threshold
  confidence: number;            // 0-100
  signals: {
    headerScore: number;         // 0-50
    filenameScore: number;       // 0-25
    contentScore: number;        // 0-25
  };
}

const HEADER_WEIGHT = 50;
const FILENAME_WEIGHT = 25;
const CONTENT_WEIGHT = 25;

class BankProfileMatcher {
  async match(file: File, format: BankFormat): Promise<BankProfileMatchResult> {
    await bankProfilesService.loadProfiles();
    const profiles = bankProfilesService.getProfiles();

    if (profiles.length === 0) {
      return {
        profile: null,
        confidence: 0,
        signals: { headerScore: 0, filenameScore: 0, contentScore: 0 },
      };
    }

    const sampleText = await this.readSample(file, format);
    const headerLine = this.firstHeaderLine(sampleText);
    const filename = file.name.toLowerCase();
    const contentLower = sampleText.toLowerCase();

    let best: BankProfileMatchResult = {
      profile: null,
      confidence: 0,
      signals: { headerScore: 0, filenameScore: 0, contentScore: 0 },
    };

    for (const profile of profiles) {
      const headerScore = this.scoreHeaders(headerLine, profile);
      const filenameScore = this.scoreFilename(filename, profile);
      const contentScore = this.scoreContent(contentLower, profile);
      const confidence = headerScore + filenameScore + contentScore;

      if (confidence > best.confidence) {
        best = {
          profile: profile.bankKey,
          confidence,
          signals: { headerScore, filenameScore, contentScore },
        };
      }
    }

    return best;
  }

  private scoreHeaders(headerLine: string, profile: BankProfile): number {
    if (!headerLine) return 0;
    const tokens = this.tokenize(headerLine);
    if (tokens.length === 0) return 0;

    const aliasGroups = Object.values(profile.headerAliases) as (string[] | undefined)[];
    let matchedGroups = 0;
    let totalGroups = 0;
    for (const aliases of aliasGroups) {
      if (!aliases || aliases.length === 0) continue;
      totalGroups++;
      const normalizedAliases = aliases.map(a => this.normalize(a));
      if (tokens.some(t => normalizedAliases.includes(t))) matchedGroups++;
    }
    if (totalGroups === 0) return 0;

    const ratio = matchedGroups / totalGroups;
    // Need at least the profile's minScore alias hits to be considered credible.
    if (matchedGroups < (profile.minScore ?? 1)) return Math.round(ratio * HEADER_WEIGHT * 0.4);
    return Math.round(ratio * HEADER_WEIGHT);
  }

  private scoreFilename(filename: string, profile: BankProfile): number {
    const key = profile.bankKey.toLowerCase();
    if (!key) return 0;
    if (filename.includes(key)) return FILENAME_WEIGHT;
    // Common filename variants seen in real exports
    const stripped = key.replace(/\s+/g, '');
    if (stripped !== key && filename.includes(stripped)) return FILENAME_WEIGHT;
    return 0;
  }

  private scoreContent(content: string, profile: BankProfile): number {
    if (!content) return 0;
    const key = profile.bankKey.toLowerCase();
    let score = 0;
    if (key && content.includes(key)) score += CONTENT_WEIGHT * 0.6;

    // Look for unique alias tokens in body content (titular/iban/oficina blocks
    // typically include the bank name). Cap so this signal can't dominate.
    const distinctive = this.distinctiveAliases(profile);
    let hits = 0;
    for (const token of distinctive) {
      if (content.includes(token)) hits++;
      if (hits >= 3) break;
    }
    score += Math.min(hits, 3) * (CONTENT_WEIGHT * 0.15);

    return Math.min(Math.round(score), CONTENT_WEIGHT);
  }

  private distinctiveAliases(profile: BankProfile): string[] {
    const all = new Set<string>();
    for (const aliases of Object.values(profile.headerAliases) as (string[] | undefined)[]) {
      if (!aliases) continue;
      for (const alias of aliases) {
        const norm = this.normalize(alias);
        if (norm.length >= 6) all.add(norm);
      }
    }
    return Array.from(all);
  }

  private firstHeaderLine(text: string): string {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      // Skip purely numeric / date lines (CSB43 envelopes etc.)
      const tokens = line.split(/[;,\t|]/).map(t => t.trim()).filter(Boolean);
      const wordy = tokens.filter(t => /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(t));
      if (wordy.length >= 2) return line;
    }
    return lines[0] ?? '';
  }

  private tokenize(line: string): string[] {
    return line
      .split(/[;,\t|]/)
      .map(t => this.normalize(t))
      .filter(Boolean);
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async readSample(file: File, format: BankFormat): Promise<string> {
    // For CSV/CSB43 we read as text (truncated). For XLS/XLSX we read the
    // workbook lazily and stringify the first sheet's first ~50 rows.
    const SAMPLE_BYTES = 64 * 1024;
    if (format === 'csv' || format === 'csb43') {
      const slice = file.size > SAMPLE_BYTES ? file.slice(0, SAMPLE_BYTES) : file;
      return await this.readBlobAsText(slice);
    }
    try {
      const XLSX = await import('xlsx');
      const buffer = await this.readBlobAsArrayBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return '';
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][];
      return rows.slice(0, 50).map(r => r.join(';')).join('\n');
    } catch {
      // Fallback: best-effort text read
      const slice = file.size > SAMPLE_BYTES ? file.slice(0, SAMPLE_BYTES) : file;
      return await this.readBlobAsText(slice).catch(() => '');
    }
  }

  private readBlobAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob, 'UTF-8');
    });
  }

  private readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }
}

export const bankProfileMatcher = new BankProfileMatcher();
