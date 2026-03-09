import { openDB, IDBPDatabase } from 'idb';
import { PersonalExpense } from '../types/personal';

const DB_NAME = 'AtlasPulseDB';
const DB_VERSION = 1;

interface PulseDB {
  personalExpenses: PersonalExpense;
}

let dbPromise: Promise<IDBPDatabase<PulseDB>>;

const getDB = async (): Promise<IDBPDatabase<PulseDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<PulseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('personalExpenses')) {
          const store = db.createObjectStore('personalExpenses', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('categoria', 'categoria', { unique: false });
          store.createIndex('frecuencia', 'frecuencia', { unique: false });
        }
      },
    });
  }
  return dbPromise;
};

export const personalExpensesService = {
  async getAll(): Promise<PersonalExpense[]> {
    const db = await getDB();
    return db.getAll('personalExpenses');
  },

  async getById(id: number): Promise<PersonalExpense | undefined> {
    const db = await getDB();
    return db.get('personalExpenses', id);
  },

  async create(gasto: Omit<PersonalExpense, 'id'>): Promise<number> {
    const db = await getDB();
    return db.add('personalExpenses', gasto as PersonalExpense);
  },

  async update(gasto: PersonalExpense): Promise<number> {
    const db = await getDB();
    return db.put('personalExpenses', gasto);
  },

  async remove(id: number): Promise<void> {
    const db = await getDB();
    return db.delete('personalExpenses', id);
  },

  /**
   * Convierte el importe de un gasto a su equivalente mensual
   * según la frecuencia indicada.
   */
  calcularImporteMensual(gasto: PersonalExpense): number {
    switch (gasto.frecuencia) {
      case 'mensual':
        return gasto.importe;
      case 'trimestral':
        return gasto.importe / 3;
      case 'semestral':
        return gasto.importe / 6;
      case 'anual':
        return gasto.importe / 12;
      default:
        return gasto.importe;
    }
  },
};
