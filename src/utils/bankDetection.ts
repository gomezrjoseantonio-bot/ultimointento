// Temporarily commented out for bundle optimization testing
// import { BankParserService } from '../features/inbox/importers/bankParser';

/**
 * Detects if a file is likely a bank statement based on:
 * 1. File extension (CSV, XLS, XLSX)
 * 2. Known bank headers (if we can parse it)
 */
export async function isBankStatementFile(file: File): Promise<boolean> {
  // Check file extension first
  const fileName = file.name.toLowerCase();
  const isBankFileType = fileName.endsWith('.csv') || 
                        fileName.endsWith('.xls') || 
                        fileName.endsWith('.xlsx');
  
  if (!isBankFileType) {
    return false;
  }
  
  // For quick detection, also check filename patterns
  const hasExtractKeywords = fileName.includes('extracto') || 
                            fileName.includes('movimiento') ||
                            fileName.includes('statement') ||
                            fileName.includes('extract');
  
  if (hasExtractKeywords) {
    return true;
  }
  
  // Try to parse the file headers to detect bank patterns
  try {
    // Temporarily commented out for bundle optimization testing
    // const bankParser = new BankParserService();
    // const parseResult = await bankParser.parseFile(file);
    
    // If bank parser successfully detected a bank and found movements, it's likely a bank statement
    // return parseResult.success && 
    //        parseResult.metadata?.bankDetected && 
    //        (parseResult.movements?.length || 0) > 0;
    
    // Fallback detection for now
    return false;
  } catch (error) {
    // If parsing fails, fallback to filename-based detection
    console.warn('Bank detection failed, using filename fallback:', error);
    return hasExtractKeywords;
  }
}

/**
 * Gets the detected bank from a file if it's a bank statement
 */
export async function detectBankFromFile(file: File): Promise<string | null> {
  try {
    // Temporarily commented out for bundle optimization testing
    // const bankParser = new BankParserService();
    // const parseResult = await bankParser.parseFile(file);
    
    // return parseResult.metadata?.bankDetected?.bankKey || null;
    return null;
  } catch (error) {
    console.warn('Bank detection failed:', error);
    return null;
  }
}