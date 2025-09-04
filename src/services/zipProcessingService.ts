// ZIP Processing Service for Bandeja de entrada
// Implements ZIP decompression, package creation, and child document processing

import JSZip from 'jszip';
import { detectDocumentType } from './documentTypeDetectionService';

export interface ZipPackage {
  id: number;
  filename: string;
  originalZip: Blob;
  uploadDate: string;
  children: ZipChildDocument[];
  metadata: {
    totalFiles: number;
    validFiles: number;
    failedFiles: number;
    packageStatus: 'processing' | 'completed' | 'partial_failure';
    origen: 'upload' | 'email';
    emailLogId?: string;
  };
}

export interface ZipChildDocument {
  id: number;
  parentPackageId: number;
  filename: string;
  originalPath: string; // Path within ZIP
  content: ArrayBuffer;
  type: string;
  size: number;
  uploadDate: string;
  metadata: {
    queueStatus: 'pendiente' | 'procesado' | 'importado' | 'error';
    tipo?: string;
    detection?: any;
    error?: string;
    processedAt?: string;
  };
}

export interface ZipProcessingResult {
  package: ZipPackage;
  children: ZipChildDocument[];
  summary: {
    totalFiles: number;
    validFiles: number;
    skippedFiles: number;
    failedFiles: number;
    supportedTypes: string[];
    unsupportedTypes: string[];
  };
}

// Supported file types for ZIP processing
const SUPPORTED_EXTENSIONS = [
  '.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', 
  '.csv', '.xls', '.xlsx', '.txt'
];

/**
 * Process a ZIP file and create package with child documents
 */
export async function processZipFile(
  zipFile: File,
  emailLogId?: string
): Promise<ZipProcessingResult> {
  const zip = new JSZip();
  
  try {
    const zipContent = await zip.loadAsync(zipFile);
    const children: ZipChildDocument[] = [];
    const summary = {
      totalFiles: 0,
      validFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      supportedTypes: [] as string[],
      unsupportedTypes: [] as string[]
    };

    // Process each file in the ZIP
    for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
      // Skip directories and hidden files
      if (zipEntry.dir || relativePath.startsWith('.') || relativePath.includes('__MACOSX')) {
        continue;
      }

      summary.totalFiles++;

      try {
        // Check if file type is supported
        const extension = getFileExtension(relativePath).toLowerCase();
        const isSupported = SUPPORTED_EXTENSIONS.includes(extension);

        if (!isSupported) {
          summary.unsupportedTypes.push(extension);
          summary.skippedFiles++;
          continue;
        }

        // Extract file content
        const content = await zipEntry.async('arraybuffer');
        const blob = new Blob([content]);
        const mimeType = getMimeTypeFromExtension(extension);

        // Create child document
        const childDoc: ZipChildDocument = {
          id: Date.now() + Math.random() * 1000, // Temporary ID
          parentPackageId: 0, // Will be set after package creation
          filename: getFilenameFromPath(relativePath),
          originalPath: relativePath,
          content,
          type: mimeType,
          size: content.byteLength,
          uploadDate: new Date().toISOString(),
          metadata: {
            queueStatus: 'pendiente'
          }
        };

        // Detect document type for each child
        try {
          const file = new File([blob], childDoc.filename, { type: mimeType });
          const detection = await detectDocumentType(file, childDoc.filename);
          
          childDoc.metadata.detection = detection;
          childDoc.metadata.tipo = detection.tipo;
        } catch (error) {
          console.warn('Document type detection failed for:', relativePath, error);
          childDoc.metadata.error = 'Document type detection failed';
        }

        children.push(childDoc);
        summary.validFiles++;
        
        if (!summary.supportedTypes.includes(extension)) {
          summary.supportedTypes.push(extension);
        }

      } catch (error) {
        console.error('Failed to process file in ZIP:', relativePath, error);
        summary.failedFiles++;
      }
    }

    // Create package record
    const packageId = Date.now();
    const packageRecord: ZipPackage = {
      id: packageId,
      filename: zipFile.name,
      originalZip: zipFile,
      uploadDate: new Date().toISOString(),
      children: [],
      metadata: {
        totalFiles: summary.totalFiles,
        validFiles: summary.validFiles,
        failedFiles: summary.failedFiles,
        packageStatus: summary.failedFiles > 0 ? 'partial_failure' : 'completed',
        origen: emailLogId ? 'email' : 'upload',
        emailLogId
      }
    };

    // Update children with package ID
    children.forEach(child => {
      child.parentPackageId = packageId;
    });

    packageRecord.children = children;

    return {
      package: packageRecord,
      children,
      summary
    };

  } catch (error) {
    throw new Error(`Error processing ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot !== -1 ? path.substring(lastDot) : '';
}

/**
 * Get filename from path (remove directory structure)
 */
function getFilenameFromPath(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.csv': 'text/csv',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain'
  };

  return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Process all children of a ZIP package
 */
export async function processZipChildren(
  children: ZipChildDocument[],
  onChildProcessed?: (child: ZipChildDocument) => void
): Promise<void> {
  for (const child of children) {
    try {
      // Each child goes through the same pipeline as individual uploads
      // This would trigger OCR, classification, and auto-save as appropriate
      
      // Update status to processing
      child.metadata.queueStatus = 'procesado';
      child.metadata.processedAt = new Date().toISOString();
      
      // Notify about processing completion
      if (onChildProcessed) {
        onChildProcessed(child);
      }
      
    } catch (error) {
      console.error('Failed to process ZIP child:', child.filename, error);
      child.metadata.queueStatus = 'error';
      child.metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (onChildProcessed) {
        onChildProcessed(child);
      }
    }
  }
}

/**
 * Delete a single child from a ZIP package
 * The original ZIP is preserved for audit purposes
 */
export async function deleteZipChild(childId: number): Promise<void> {
  // This would remove the child document but keep the ZIP package record
  console.log('Deleting ZIP child:', childId);
  // Implementation would update the database to mark the child as deleted
  // but preserve the original ZIP file in the package record
}