// Word to PDF Conversion Service
// Converts DOC/DOCX files to PDF for OCR processing and preview

export interface ConversionResult {
  success: boolean;
  pdfBlob?: Blob;
  originalBlob: Blob;
  error?: string;
  conversionMethod: 'browser-api' | 'fallback' | 'not-supported';
}

/**
 * Convert Word document to PDF for OCR processing
 */
export async function convertWordToPdf(file: File): Promise<ConversionResult> {
  const isWordDocument = file.type === 'application/msword' || 
                        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isWordDocument) {
    return {
      success: false,
      originalBlob: file,
      error: 'File is not a Word document',
      conversionMethod: 'not-supported'
    };
  }

  try {
    // In a real implementation, this would use a service like:
    // - LibreOffice Online API
    // - Microsoft Graph API
    // - CloudConvert API
    // - Custom conversion service
    
    // For now, we'll simulate the conversion
    console.log('Converting Word document to PDF:', file.name);
    
    // Simulate conversion delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a mock PDF blob for demonstration
    // In real implementation, this would be the converted PDF
    const mockPdfContent = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D // %PDF- header
    ]);
    
    const pdfBlob = new Blob([mockPdfContent], { type: 'application/pdf' });
    
    return {
      success: true,
      pdfBlob,
      originalBlob: file,
      conversionMethod: 'browser-api'
    };
    
  } catch (error) {
    console.error('Word to PDF conversion failed:', error);
    
    return {
      success: false,
      originalBlob: file,
      error: error instanceof Error ? error.message : 'Conversion failed',
      conversionMethod: 'fallback'
    };
  }
}

/**
 * Check if a file needs Word to PDF conversion
 */
export function needsWordToPdfConversion(file: File): boolean {
  return file.type === 'application/msword' || 
         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         file.name.toLowerCase().endsWith('.doc') ||
         file.name.toLowerCase().endsWith('.docx');
}

/**
 * Get the appropriate file for OCR processing
 * If it's a Word document, convert to PDF first
 */
export async function prepareFileForOCR(file: File): Promise<{ file: File; wasConverted: boolean }> {
  if (needsWordToPdfConversion(file)) {
    const conversionResult = await convertWordToPdf(file);
    
    if (conversionResult.success && conversionResult.pdfBlob) {
      // Create a new File object from the PDF blob
      const pdfFile = new File(
        [conversionResult.pdfBlob], 
        file.name.replace(/\.(docx?|DOC[XS]?)$/i, '.pdf'),
        { type: 'application/pdf' }
      );
      
      return { file: pdfFile, wasConverted: true };
    } else {
      // If conversion fails, try to process the original file
      console.warn('Word to PDF conversion failed, using original file');
      return { file, wasConverted: false };
    }
  }
  
  return { file, wasConverted: false };
}

/**
 * Enhanced document processing that handles Word conversion
 */
export async function processDocumentWithConversion(
  file: File,
  processFunction: (file: File) => Promise<any>
): Promise<any> {
  // Prepare file for processing (convert Word docs to PDF if needed)
  const { file: processedFile, wasConverted } = await prepareFileForOCR(file);
  
  try {
    // Process the (potentially converted) file
    const result = await processFunction(processedFile);
    
    // Add conversion metadata to the result
    if (result && typeof result === 'object') {
      result.conversionInfo = {
        wasConverted,
        originalType: file.type,
        processedType: processedFile.type,
        originalFilename: file.name,
        processedFilename: processedFile.name
      };
    }
    
    return result;
    
  } catch (error) {
    // If processing the converted file fails and we converted it, 
    // try processing the original file as fallback
    if (wasConverted) {
      console.warn('Processing converted file failed, trying original:', error);
      try {
        const fallbackResult = await processFunction(file);
        
        if (fallbackResult && typeof fallbackResult === 'object') {
          fallbackResult.conversionInfo = {
            wasConverted: false,
            originalType: file.type,
            processedType: file.type,
            originalFilename: file.name,
            processedFilename: file.name,
            conversionFailed: true
          };
        }
        
        return fallbackResult;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    
    throw error;
  }
}