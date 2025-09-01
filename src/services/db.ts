import { openDB, IDBPDatabase } from 'idb';
import JSZip from 'jszip';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 1;

export interface Property {
  id?: number;
  alias: string;
  address: string;
  postalCode: string;
  province: string;
  municipality: string;
  ccaa: string;
  purchaseDate: string;
  cadastralReference?: string;
  squareMeters: number;
  bedrooms: number;
  bathrooms?: number;
  transmissionRegime: 'usada' | 'obra-nueva';
  state: 'activo' | 'vendido' | 'baja';
  notes?: string;
  acquisitionCosts: {
    price: number;
    itp?: number;
    itpIsManual?: boolean;
    iva?: number;
    notary?: number;
    registry?: number;
    management?: number;
    psi?: number;
    realEstate?: number;
    other?: Array<{ concept: string; amount: number; }>;
  };
  documents: number[];
}

export interface Document {
  id?: number;
  filename: string;
  type: string;
  size: number;
  lastModified: number;
  content: Blob;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    entityType?: 'property' | 'contract' | 'expense' | 'personal';
    entityId?: number;
  };
  uploadDate: string;
}

export interface Contract {
  id?: number;
  propertyId: number;
  type: 'full-property' | 'room';
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  guarantees: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  documents: number[];
}

export interface Expense {
  id?: number;
  propertyId: number;
  date: string;
  amount: number;
  description: string;
  category: 'repair' | 'capex' | 'furniture' | 'tax' | 'utility' | 'management' | 'other';
  isCapex: boolean;
  capexBreakdown?: {
    construction: number;
    materials: number;
    labor: number;
    permits: number;
    other: number;
  };
  documentId?: number;
}

interface AtlasHorizonDB {
  properties: Property;
  documents: Document;
  contracts: Contract;
  expenses: Expense;
}

let dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>;

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<AtlasHorizonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Properties store
        if (!db.objectStoreNames.contains('properties')) {
          const propertyStore = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
          propertyStore.createIndex('alias', 'alias', { unique: false });
          propertyStore.createIndex('address', 'address', { unique: false });
        }

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
          documentStore.createIndex('type', 'type', { unique: false });
          documentStore.createIndex('entityType', 'metadata.entityType', { unique: false });
          documentStore.createIndex('entityId', 'metadata.entityId', { unique: false });
        }

        // Contracts store
        if (!db.objectStoreNames.contains('contracts')) {
          const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
          contractStore.createIndex('propertyId', 'propertyId', { unique: false });
        }

        // Expenses store
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenseStore.createIndex('propertyId', 'propertyId', { unique: false });
          expenseStore.createIndex('category', 'category', { unique: false });
          expenseStore.createIndex('isCapex', 'isCapex', { unique: false });
        }
      }
    });
  }
  return dbPromise;
};

// Blob storage and download utilities (H0.4 requirement)
export const getDocumentBlob = async (id: number): Promise<Blob | null> => {
  try {
    const db = await initDB();
    const doc = await db.get('documents', id);
    return doc?.content || null;
  } catch (error) {
    console.error('Error retrieving document blob:', error);
    return null;
  }
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  try {
    // For iOS/Safari compatibility, try dataURL method first for smaller files
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOSSafari && blob.size < 50 * 1024 * 1024) { // < 50MB for iOS Safari
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } else {
      // Standard blob URL method for other browsers
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('No se pudo descargar el archivo');
  }
};

export const saveDocumentWithBlob = async (document: Omit<Document, 'id'> & { id?: number }): Promise<number> => {
  try {
    const db = await initDB();
    
    // Ensure proper type detection for ZIP files
    if (!document.type || document.type === '') {
      const filename = document.filename.toLowerCase();
      if (filename.endsWith('.zip')) {
        document.type = 'application/zip';
      } else {
        document.type = 'application/octet-stream';
      }
    }
    
    // Add metadata for blob storage
    const docWithMetadata = {
      ...document,
      metadata: {
        ...document.metadata,
        createdAt: new Date().toISOString(),
        blobStored: true,
      }
    };
    
    if (document.id) {
      await db.put('documents', docWithMetadata as Document);
      return document.id;
    } else {
      const id = await db.add('documents', docWithMetadata);
      return id as number;
    }
  } catch (error) {
    console.error('Error saving document with blob:', error);
    throw new Error('No se pudo guardar el documento');
  }
};

export const deleteDocumentAndBlob = async (id: number): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete('documents', id);
    // The blob is automatically deleted with the document record
  } catch (error) {
    console.error('Error deleting document and blob:', error);
    throw new Error('No se pudo eliminar el documento');
  }
};

// Enhanced Export & Import snapshot functions with ZIP support (H1 requirement)
export const exportSnapshot = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Get all data from the database
    const [properties, documents, contracts, expenses] = await Promise.all([
      db.getAll('properties'),
      db.getAll('documents'),
      db.getAll('contracts'),
      db.getAll('expenses'),
    ]);

    // Create a new ZIP file
    const zip = new JSZip();
    
    // Create the main data JSON
    const dataObj = {
      properties,
      contracts,
      expenses,
      documents: documents.map(doc => ({
        ...doc,
        content: null, // We'll store files separately
      })),
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        app: 'ATLAS-Horizon-Pulse'
      }
    };
    
    // Add the main data file
    zip.file('atlas-data.json', JSON.stringify(dataObj, null, 2));
    
    // Add document files to a documents folder
    const documentsFolder = zip.folder('documents');
    if (documentsFolder) {
      for (const doc of documents) {
        if (doc.content && doc.content instanceof Blob) {
          // Use document ID as filename to avoid conflicts, keep original extension
          const extension = doc.filename.split('.').pop() || 'bin';
          const safeFilename = `${doc.id}.${extension}`;
          documentsFolder.file(safeFilename, doc.content);
          
          // Also create a mapping file for filename reference
          documentsFolder.file(`${doc.id}.meta.json`, JSON.stringify({
            originalFilename: doc.filename,
            type: doc.type,
            uploadDate: doc.uploadDate,
            metadata: doc.metadata
          }, null, 2));
        }
      }
    }
    
    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create filename with current date and time
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
    const dateStr = timestamp[0].replace(/-/g, '');
    const timeStr = timestamp[1].split('-')[0].replace(/-/g, '');
    const filename = `ATLAS-snapshot-${dateStr}-${timeStr}.zip`;
    
    // Download the ZIP file
    downloadBlob(zipBlob, filename);
    
  } catch (error) {
    console.error('Error exporting snapshot:', error);
    throw new Error('No se pudo exportar el snapshot');
  }
};

export const importSnapshot = async (file: File, mode: 'replace' | 'merge' = 'replace'): Promise<void> => {
  try {
    const db = await initDB();
    
    // Read the ZIP file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    // Get the main data file
    const dataFile = zipContent.file('atlas-data.json');
    if (!dataFile) {
      throw new Error('Archivo de snapshot inválido: no se encontró atlas-data.json');
    }
    
    const dataJson = await dataFile.async('text');
    const data = JSON.parse(dataJson);
    
    // Validate the data structure
    if (!data.properties || !data.documents || !data.contracts || !data.expenses) {
      throw new Error('Archivo de snapshot inválido: estructura de datos incorrecta');
    }
    
    // Start transaction
    const tx = db.transaction(['properties', 'documents', 'contracts', 'expenses'], 'readwrite');
    
    // Clear existing data if replace mode
    if (mode === 'replace') {
      await Promise.all([
        tx.objectStore('properties').clear(),
        tx.objectStore('documents').clear(),
        tx.objectStore('contracts').clear(),
        tx.objectStore('expenses').clear(),
      ]);
    }
    
    // Import properties
    for (const property of data.properties) {
      if (mode === 'merge' && property.id) {
        await tx.objectStore('properties').put(property);
      } else {
        const { id, ...propertyWithoutId } = property;
        await tx.objectStore('properties').add(propertyWithoutId);
      }
    }
    
    // Import contracts
    for (const contract of data.contracts) {
      if (mode === 'merge' && contract.id) {
        await tx.objectStore('contracts').put(contract);
      } else {
        const { id, ...contractWithoutId } = contract;
        await tx.objectStore('contracts').add(contractWithoutId);
      }
    }
    
    // Import expenses
    for (const expense of data.expenses) {
      if (mode === 'merge' && expense.id) {
        await tx.objectStore('expenses').put(expense);
      } else {
        const { id, ...expenseWithoutId } = expense;
        await tx.objectStore('expenses').add(expenseWithoutId);
      }
    }
    
    // Import documents with their files
    const documentsFolder = zipContent.folder('documents');
    for (const document of data.documents) {
      let documentBlob: Blob | null = null;
      
      if (documentsFolder && document.id) {
        // Try to find the document file
        const extension = document.filename.split('.').pop() || 'bin';
        const documentFile = documentsFolder.file(`${document.id}.${extension}`);
        
        if (documentFile) {
          // Reconstruct the blob from the ZIP
          const fileData = await documentFile.async('blob');
          documentBlob = new Blob([fileData], { type: document.type });
        }
      }
      
      const docToImport = {
        ...document,
        content: documentBlob || new Blob([''], { type: 'text/plain' })
      };
      
      if (mode === 'merge' && document.id) {
        await tx.objectStore('documents').put(docToImport);
      } else {
        const { id, ...docWithoutId } = docToImport;
        await tx.objectStore('documents').add(docWithoutId);
      }
    }
    
    await tx.done;
    
  } catch (error) {
    console.error('Error importing snapshot:', error);
    throw new Error('No se pudo importar el snapshot: ' + (error instanceof Error ? error.message : 'Error desconocido'));
  }
};

export const resetAllData = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Start transaction to clear all stores
    const tx = db.transaction(['properties', 'documents', 'contracts', 'expenses'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('properties').clear(),
      tx.objectStore('documents').clear(),
      tx.objectStore('contracts').clear(),
      tx.objectStore('expenses').clear(),
    ]);
    
    await tx.done;
    
    // Also clear localStorage backup
    localStorage.removeItem('atlas-inbox-documents');
    
  } catch (error) {
    console.error('Error resetting data:', error);
    throw new Error('No se pudo restablecer los datos');
  }
};