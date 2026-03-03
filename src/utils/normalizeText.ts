export const normalizeText = (value?: string): string =>
  value?.toLowerCase().trim().replace(/\s+/g, ' ') ?? '';

