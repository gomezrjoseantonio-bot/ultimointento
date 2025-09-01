import { openDB, IDBPDatabase } from 'idb';
import JSZip from 'jszip';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 4; // H7: Updated for contract enhancements

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
    ivaIsManual?: boolean;
    notary?: number;
    registry?: number;
    management?: number;
    psi?: number;
    realEstate?: number;
    other?: Array<{ concept: string; amount: number; }>;
  };
  documents: number[];
  // H5: Datos fiscales auxiliares
  fiscalData?: {
    cadastralValue?: number;
    constructionCadastralValue?: number;
    constructionPercentage?: number;
    acquisitionDate?: string;
    contractUse?: 'vivienda-habitual' | 'turistico' | 'otros';
    housingReduction?: boolean;
    isAccessory?: boolean;
    mainPropertyId?: number;
    accessoryData?: {
      cadastralReference: string;
      acquisitionDate: string;
      cadastralValue: number;
      constructionCadastralValue: number;
    };
  };
}

// H-OCR: OCR field definition
export interface OCRField {
  name: string;
  value: string;
  confidence: number; // 0-1
  raw?: string; // Original raw value before normalization
}

// H-OCR: OCR result structure
export interface OCRResult {
  engine: string; // e.g., "gdocai:invoice"
  timestamp: string;
  confidenceGlobal: number; // Overall confidence 0-1
  fields: OCRField[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  engineInfo?: {
    type: 'document-ai-invoice' | 'vision-fallback';
    displayName: string;
    description: string;
  }; // H-OCR-FIX: Engine transparency information
  pageInfo?: {
    totalPages: number;
    selectedPage: number;
    pageScore: number;
    allPageScores: number[];
  }; // H-OCR-FIX: Multi-page processing information
}

// H-OCR: OCR history entry
export interface OCRHistoryEntry {
  timestamp: string;
  engine: string;
  confidenceGlobal: number;
  fieldsCount: number;
  status: 'completed' | 'error';
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
    // H-OCR: OCR metadata
    ocr?: OCRResult;
    ocrHistory?: OCRHistoryEntry[];
  };
  uploadDate: string;
}

// H7: Enhanced Contract interface
export interface Contract {
  id?: number;
  propertyId: number;
  // Property scope
  scope: 'full-property' | 'units';
  selectedUnits?: string[]; // For multi-unit properties (e.g., ['H1', 'H2'])
  type: 'vivienda' | 'habitacion';
  
  // Tenant information
  tenant: {
    name: string;
    nif?: string;
    email?: string;
  };
  
  // Contract dates
  startDate: string;
  endDate?: string; // Optional for indefinite contracts
  isIndefinite: boolean;
  noticePeriodDays?: number;
  
  // Financial terms
  monthlyRent: number;
  paymentDay: number; // 1-31
  periodicity: 'monthly'; // Only monthly for now
  
  // Rent updates
  rentUpdate: {
    type: 'none' | 'fixed-percentage' | 'ipc';
    fixedPercentage?: number; // For fixed percentage updates
    ipcPercentage?: number; // Manual IPC percentage
  };
  
  // Deposit and guarantees
  deposit: {
    months: number;
    amount: number; // Calculated but editable
  };
  additionalGuarantees?: number;
  
  // Services (informational checkboxes)
  includedServices: {
    electricity?: boolean;
    water?: boolean;
    gas?: boolean;
    internet?: boolean;
    cleaning?: boolean;
    [key: string]: boolean | undefined;
  };
  
  // Notes and status
  privateNotes?: string;
  status: 'active' | 'upcoming' | 'terminated';
  
  // Documents
  documents: number[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// H7: Rent calendar entry
export interface RentCalendar {
  id?: number;
  contractId: number;
  period: string; // YYYY-MM format
  expectedAmount: number;
  isProrated: boolean;
  proratedDays?: number;
  totalDaysInMonth?: number;
  notes?: string;
  createdAt: string;
}

// H7: Rent payment tracking
export interface RentPayment {
  id?: number;
  contractId: number;
  period: string; // YYYY-MM format
  expectedAmount: number;
  status: 'pending' | 'paid' | 'partial';
  
  // Payment details
  paidAmount?: number;
  paymentDate?: string;
  paymentNotes?: string;
  
  // Documents
  receiptDocuments: number[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// H5: AEAT Tax Classification Types
export type AEATFiscalType = 
  | 'financiacion'           // Financing (interests and associated costs)
  | 'reparacion-conservacion' // Repair & Conservation (R&C)
  | 'comunidad'              // Community fees
  | 'suministros'            // Utilities
  | 'seguros'                // Insurance
  | 'tributos-locales'       // Local taxes (IBI, waste, lighting; no fines)
  | 'servicios-personales'   // Personal services (cleaning, external maintenance, etc.)
  | 'amortizacion-muebles'   // Furniture amortization (10 years)
  | 'capex-mejora-ampliacion'; // CAPEX (Improvement/Expansion)

export type AEATBox = 
  | '0105' // Interests/financing
  | '0106' // R&C
  | '0109' // Community
  | '0112' // Personal services
  | '0113' // Utilities
  | '0114' // Insurance
  | '0115' // Local taxes
  | '0117'; // Furniture amortization

export type ProrationMethod = 'metros-cuadrados' | 'unidades' | 'porcentaje-manual' | 'ocupacion';

export type ExpenseStatus = 'validado' | 'pendiente' | 'por-revisar';

export type ExpenseOrigin = 'manual' | 'inbox';

// H5: Enhanced Expense interface
export interface ExpenseH5 {
  id?: number;
  date: string;
  provider: string;
  providerNIF?: string;
  concept: string;
  amount: number;
  fiscalType: AEATFiscalType;
  aeatBox?: AEATBox;
  taxYear: number; // Ejercicio de devengo
  taxIncluded: boolean;
  propertyId: number;
  unit: 'completo' | string; // 'completo' or 'habitacion-X'
  prorationMethod: ProrationMethod;
  prorationDetail: string; // % or other details based on method
  status: ExpenseStatus;
  origin: ExpenseOrigin;
  documentId?: number;
  createdAt: string;
  updatedAt: string;
}

// H5: CAPEX Treatment Types
export type CAPEXTreatment = 'capex-mejora' | 'mobiliario-10-años' | 'reparacion-conservacion';

export type ReformStatus = 'abierta' | 'cerrada';

// H5: Reform (CAPEX project)
export interface Reform {
  id?: number;
  title: string;
  propertyId: number;
  startDate: string;
  endDate?: string;
  notes?: string;
  status: ReformStatus;
  createdAt: string;
  updatedAt: string;
}

// H5: Reform Line Item
export interface ReformLineItem {
  id?: number;
  reformId: number;
  source: 'documento' | 'manual';
  documentId?: number;
  provider: string;
  providerNIF?: string;
  concept: string;
  amount: number;
  taxIncluded: boolean;
  treatment: CAPEXTreatment;
  aeatBoxSuggested?: AEATBox;
  executionDate: string;
  prorationMethod: ProrationMethod;
  prorationDetail: string;
  createdAt: string;
  updatedAt: string;
}

// H5: AEAT Limit and Carryforward tracking
export interface AEATCarryForward {
  id?: number;
  propertyId: number;
  taxYear: number;
  totalIncome: number; // Ingresos íntegros del inmueble
  financingAndRepair: number; // Financiación + R&C
  limitApplied: number; // min(financingAndRepair, totalIncome)
  excessAmount: number; // financingAndRepair - limitApplied
  expirationYear: number; // taxYear + 4
  remainingAmount: number; // Current remaining amount that can be used
  createdAt: string;
  updatedAt: string;
}

// H5: Rental/Availability days tracking
export interface PropertyDays {
  id?: number;
  propertyId: number;
  taxYear: number;
  daysRented: number;
  daysAvailable: number;
  createdAt: string;
  updatedAt: string;
}

// Legacy Expense interface (keep for backward compatibility)
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
  rentCalendar: RentCalendar; // H7: Rent calendar entries
  rentPayments: RentPayment; // H7: Rent payment tracking
  expenses: Expense; // Legacy
  expensesH5: ExpenseH5; // H5: New expense system
  reforms: Reform; // H5: CAPEX reforms
  reformLineItems: ReformLineItem; // H5: Reform line items
  aeatCarryForwards: AEATCarryForward; // H5: Tax carryforwards
  propertyDays: PropertyDays; // H5: Rental/availability days
  kpiConfigurations: any; // H6: KPI configurations
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

        // Legacy Expenses store (keep for backward compatibility)
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenseStore.createIndex('propertyId', 'propertyId', { unique: false });
          expenseStore.createIndex('category', 'category', { unique: false });
          expenseStore.createIndex('isCapex', 'isCapex', { unique: false });
        }

        // H5: Enhanced Expenses store
        if (!db.objectStoreNames.contains('expensesH5')) {
          const expenseH5Store = db.createObjectStore('expensesH5', { keyPath: 'id', autoIncrement: true });
          expenseH5Store.createIndex('propertyId', 'propertyId', { unique: false });
          expenseH5Store.createIndex('fiscalType', 'fiscalType', { unique: false });
          expenseH5Store.createIndex('taxYear', 'taxYear', { unique: false });
          expenseH5Store.createIndex('status', 'status', { unique: false });
          expenseH5Store.createIndex('origin', 'origin', { unique: false });
          expenseH5Store.createIndex('date', 'date', { unique: false });
        }

        // H5: Reforms store
        if (!db.objectStoreNames.contains('reforms')) {
          const reformStore = db.createObjectStore('reforms', { keyPath: 'id', autoIncrement: true });
          reformStore.createIndex('propertyId', 'propertyId', { unique: false });
          reformStore.createIndex('status', 'status', { unique: false });
        }

        // H5: Reform Line Items store
        if (!db.objectStoreNames.contains('reformLineItems')) {
          const reformLineItemStore = db.createObjectStore('reformLineItems', { keyPath: 'id', autoIncrement: true });
          reformLineItemStore.createIndex('reformId', 'reformId', { unique: false });
          reformLineItemStore.createIndex('treatment', 'treatment', { unique: false });
          reformLineItemStore.createIndex('source', 'source', { unique: false });
        }

        // H5: AEAT Carry Forwards store
        if (!db.objectStoreNames.contains('aeatCarryForwards')) {
          const carryForwardStore = db.createObjectStore('aeatCarryForwards', { keyPath: 'id', autoIncrement: true });
          carryForwardStore.createIndex('propertyId', 'propertyId', { unique: false });
          carryForwardStore.createIndex('taxYear', 'taxYear', { unique: false });
          carryForwardStore.createIndex('expirationYear', 'expirationYear', { unique: false });
        }

        // H5: Property Days store
        if (!db.objectStoreNames.contains('propertyDays')) {
          const propertyDaysStore = db.createObjectStore('propertyDays', { keyPath: 'id', autoIncrement: true });
          propertyDaysStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertyDaysStore.createIndex('taxYear', 'taxYear', { unique: false });
          propertyDaysStore.createIndex('property-year', ['propertyId', 'taxYear'], { unique: true });
        }

        // H6: KPI Configurations store
        if (!db.objectStoreNames.contains('kpiConfigurations')) {
          db.createObjectStore('kpiConfigurations', { keyPath: 'id' }); // id will be 'horizon' or 'pulse'
        }

        // H7: Rent Calendar store
        if (!db.objectStoreNames.contains('rentCalendar')) {
          const rentCalendarStore = db.createObjectStore('rentCalendar', { keyPath: 'id', autoIncrement: true });
          rentCalendarStore.createIndex('contractId', 'contractId', { unique: false });
          rentCalendarStore.createIndex('period', 'period', { unique: false });
        }

        // H7: Rent Payments store
        if (!db.objectStoreNames.contains('rentPayments')) {
          const rentPaymentsStore = db.createObjectStore('rentPayments', { keyPath: 'id', autoIncrement: true });
          rentPaymentsStore.createIndex('contractId', 'contractId', { unique: false });
          rentPaymentsStore.createIndex('period', 'period', { unique: false });
          rentPaymentsStore.createIndex('status', 'status', { unique: false });
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
    const tx = db.transaction(['properties', 'documents', 'contracts', 'rentCalendar', 'rentPayments', 'expenses'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('properties').clear(),
      tx.objectStore('documents').clear(),
      tx.objectStore('contracts').clear(),
      tx.objectStore('rentCalendar').clear(),
      tx.objectStore('rentPayments').clear(),
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