import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 1;

export interface Property {
  id?: number;
  alias: string;
  address: string;
  purchaseDate: string;
  squareMeters: number;
  bedrooms: number;
  bathrooms: number;
  cadastralReference: string;
  acquisitionCosts: {
    price: number;
    tax: number;
    notary: number;
    registry: number;
    agency: number;
    realEstateAgent: number;
    other: number;
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

// Export & Import snapshot functions (H1 requirement)
export const exportSnapshot = async () => {
  const db = await initDB();
  const data = {
    properties: await db.getAll('properties'),
    documents: await db.getAll('documents'),
    contracts: await db.getAll('contracts'),
    expenses: await db.getAll('expenses'),
  };
  
  // Convert to JSON string
  const jsonString = JSON.stringify(data);
  
  // Create a Blob from the JSON string
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  // Create a download link and trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atlas-horizon-snapshot-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importSnapshot = async (file: File) => {
  const db = await initDB();
  
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Start a transaction
        const tx = db.transaction(['properties', 'documents', 'contracts', 'expenses'], 'readwrite');
        
        // Clear existing data
        await tx.objectStore('properties').clear();
        await tx.objectStore('documents').clear();
        await tx.objectStore('contracts').clear();
        await tx.objectStore('expenses').clear();
        
        // Import each property
        for (const property of data.properties) {
          await tx.objectStore('properties').add(property);
        }
        
        // Import each document
        for (const document of data.documents) {
          // Convert base64 document content back to Blob if needed
          if (typeof document.content === 'string') {
            const contentParts = document.content.split(',');
            const contentType = contentParts[0].split(':')[1].split(';')[0];
            const binary = atob(contentParts[1]);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              array[i] = binary.charCodeAt(i);
            }
            document.content = new Blob([array], { type: contentType });
          }
          await tx.objectStore('documents').add(document);
        }
        
        // Import each contract
        for (const contract of data.contracts) {
          await tx.objectStore('contracts').add(contract);
        }
        
        // Import each expense
        for (const expense of data.expenses) {
          await tx.objectStore('expenses').add(expense);
        }
        
        await tx.done;
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsText(file);
  });
};