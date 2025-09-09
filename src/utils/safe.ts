/**
 * Safe utility functions to prevent errors when working with potentially undefined values
 * Required for fixing .match() errors on undefined values in bank import process
 */

/**
 * Safely converts unknown value to string
 * @param v - Value to convert
 * @returns String representation or empty string if null/undefined
 */
export const asString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
};

/**
 * Safely calls .match() on potentially undefined values
 * @param v - Value to match against (can be undefined/null)
 * @param re - Regular expression to match
 * @returns Match result or null if value is null/undefined
 */
export const safeMatch = (v: unknown, re: RegExp): RegExpMatchArray | null => {
  const s = asString(v);
  return s ? s.match(re) : null;
};

/**
 * Safely extracts text from potentially undefined values for text processing
 * @param v - Value to extract text from
 * @returns Trimmed string or empty string if null/undefined
 */
export const safeText = (v: unknown): string => {
  const s = asString(v);
  return s.trim();
};

/**
 * Safely checks if a value contains a substring (case-insensitive)
 * @param v - Value to search in
 * @param searchTerm - Term to search for
 * @returns True if found, false otherwise
 */
export const safeIncludes = (v: unknown, searchTerm: string): boolean => {
  const s = asString(v).toLowerCase();
  return s.includes(searchTerm.toLowerCase());
};