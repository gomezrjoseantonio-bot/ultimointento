import type { Document } from '../services/db';

type DocumentMetadata = Document['metadata'];

export interface PayrollDetectionResult {
  metadata: Partial<DocumentMetadata>;
  confidence: number;
}

const PAYROLL_KEYWORDS = ['nomina', 'nómina', 'payroll', 'payslip', 'salary', 'sueldo'];

interface MonthDefinition {
  number: number;
  label: string;
  patterns: string[];
}

const MONTH_DEFINITIONS: MonthDefinition[] = [
  { number: 1, label: 'Enero', patterns: ['enero', 'ene', 'january', 'jan'] },
  { number: 2, label: 'Febrero', patterns: ['febrero', 'feb', 'february'] },
  { number: 3, label: 'Marzo', patterns: ['marzo', 'mar', 'march'] },
  { number: 4, label: 'Abril', patterns: ['abril', 'abr', 'april', 'apr'] },
  { number: 5, label: 'Mayo', patterns: ['mayo', 'may'] },
  { number: 6, label: 'Junio', patterns: ['junio', 'jun', 'june'] },
  { number: 7, label: 'Julio', patterns: ['julio', 'jul', 'july'] },
  { number: 8, label: 'Agosto', patterns: ['agosto', 'ago', 'august', 'aug'] },
  { number: 9, label: 'Septiembre', patterns: ['septiembre', 'setiembre', 'sept', 'sep'] },
  { number: 10, label: 'Octubre', patterns: ['octubre', 'oct', 'october'] },
  { number: 11, label: 'Noviembre', patterns: ['noviembre', 'nov', 'november'] },
  { number: 12, label: 'Diciembre', patterns: ['diciembre', 'dic', 'december', 'dec'] }
];

const NUMERIC_MONTH_PATTERN = /(nomina|nómina|payroll|payslip|salary|sueldo)[\s_-]*(?:de[\s_-]*)?(1[0-2]|0?[1-9])/i;

const sanitizeFileName = (fileName: string): string => {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');

  const normalized = withoutExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return normalized;
};

const hasPayrollKeyword = (sanitized: string): boolean => {
  return PAYROLL_KEYWORDS.some((keyword) => {
    const normalizedKeyword = keyword
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const regex = new RegExp(`\\b${normalizedKeyword}\\b`, 'i');
    return regex.test(sanitized);
  });
};

const findMonthInfo = (sanitized: string): MonthDefinition | null => {
  for (const month of MONTH_DEFINITIONS) {
    if (month.patterns.some((pattern) => new RegExp(`\\b${pattern}\\b`, 'i').test(sanitized))) {
      return month;
    }
  }

  const numericMatch = sanitized.match(NUMERIC_MONTH_PATTERN);
  if (numericMatch) {
    const monthNumber = parseInt(numericMatch[2], 10);
    const monthDefinition = MONTH_DEFINITIONS.find((month) => month.number === monthNumber);
    if (monthDefinition) {
      return monthDefinition;
    }
  }

  return null;
};

const extractYear = (sanitized: string, fallbackYear: number): number => {
  const yearMatch = sanitized.match(/(20\d{2})/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  return fallbackYear;
};

const formatISODate = (year: number, month: number, day: number): string => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().split('T')[0];
};

const buildServicePeriod = (year: number, month: number) => {
  const from = formatISODate(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = formatISODate(year, month, lastDay);
  return { from, to };
};

const mergeTags = (...tagGroups: (string[] | undefined)[]): string[] => {
  const set = new Set<string>();
  for (const group of tagGroups) {
    if (!group) continue;
    for (const tag of group) {
      if (tag && tag.trim()) {
        set.add(tag.trim());
      }
    }
  }
  return Array.from(set);
};

export const isPayrollFileName = (fileName: string): boolean => {
  const sanitized = sanitizeFileName(fileName);
  return sanitized.length > 0 && hasPayrollKeyword(sanitized);
};

export const detectPayrollMetadata = (
  fileName: string,
  lastModified: number
): PayrollDetectionResult | null => {
  const sanitized = sanitizeFileName(fileName);
  if (!hasPayrollKeyword(sanitized)) {
    return null;
  }

  const monthInfo = findMonthInfo(sanitized);
  const fallbackYear = new Date(lastModified || Date.now()).getUTCFullYear();

  const baseMetadata: Partial<DocumentMetadata> = {
    categoria: 'Nómina',
    destino: 'Personal',
    tags: ['Nómina']
  };

  if (!monthInfo) {
    return {
      metadata: baseMetadata,
      confidence: 0.85
    };
  }

  const year = extractYear(sanitized, fallbackYear);
  const servicePeriod = buildServicePeriod(year, monthInfo.number);
  const tags = mergeTags(baseMetadata.tags, [monthInfo.label, String(year)]);

  return {
    metadata: {
      ...baseMetadata,
      tags,
      description: `Nómina ${monthInfo.label} ${year}`,
      notas: `Documento de nómina correspondiente a ${monthInfo.label} ${year}`,
      financialData: {
        ...(baseMetadata.financialData || {}),
        issueDate: servicePeriod.to,
        servicePeriod
      }
    },
    confidence: 0.95
  };
};

export const __internal = {
  sanitizeFileName,
  findMonthInfo,
  extractYear,
  mergeTags,
  NUMERIC_MONTH_PATTERN
};
