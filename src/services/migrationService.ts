import { initDB } from './db';

/**
 * Migration Service for Proveedor → Contraparte
 * 
 * Handles transparent migration of existing data from "proveedor" to "contraparte"
 * fields in movements and related entities.
 */

export interface MigrationResult {
  migratedMovements: number;
  migratedDocuments: number;
  errors: string[];
}

/**
 * Perform the complete proveedor → contraparte migration
 * Should be run once on application startup
 */
export const performProveedorToContraparteMigration = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    migratedMovements: 0,
    migratedDocuments: 0,
    errors: []
  };

  try {
    const db = await initDB();
    
    // Check if migration has already been performed
    const migrationStatus = await db.get('keyval', 'proveedor-contraparte-migration');
    if (migrationStatus === 'completed') {
      console.log('Proveedor → Contraparte migration already completed');
      return result;
    }

    // Migrate movements
    try {
      const movements = await db.getAll('movements');
      for (const movement of movements) {
        let needsUpdate = false;
        
        // Check if movement has old proveedor field and counterparty is empty/undefined
        if ((movement as any).proveedor && !movement.counterparty) {
          movement.counterparty = (movement as any).proveedor;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          // Remove old proveedor field
          delete (movement as any).proveedor;
          movement.updatedAt = new Date().toISOString();
          
          await db.put('movements', movement);
          result.migratedMovements++;
        }
      }
    } catch (error) {
      result.errors.push(`Error migrating movements: ${error}`);
    }

    // Migrate documents metadata
    try {
      const documents = await db.getAll('documents');
      for (const document of documents) {
        let needsUpdate = false;
        
        if (document.metadata) {
          // Migrate proveedor to counterpartyName if counterpartyName is empty
          if (document.metadata.proveedor && !document.metadata.counterpartyName) {
            document.metadata.counterpartyName = document.metadata.proveedor;
            needsUpdate = true;
          }
          
          // Also set contraparte for backward compatibility if it doesn't exist
          if (document.metadata.proveedor && !document.metadata.contraparte) {
            document.metadata.contraparte = document.metadata.proveedor;
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await db.put('documents', document);
          result.migratedDocuments++;
        }
      }
    } catch (error) {
      result.errors.push(`Error migrating documents: ${error}`);
    }

    // Mark migration as completed
    await db.put('keyval', 'completed', 'proveedor-contraparte-migration');
    
    console.log('Proveedor → Contraparte migration completed:', result);
    
  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
    console.error('Migration error:', error);
  }

  return result;
};

/**
 * Utility function to get counterparty from various possible fields
 * Used during transition period to ensure compatibility
 */
export const getCounterpartyFromMovement = (movement: any): string => {
  return movement.counterparty || movement.proveedor || '';
};

/**
 * Utility function to normalize counterparty input for APIs
 * Accepts both proveedor and counterparty for transition compatibility
 */
export const normalizeCounterpartyInput = (input: { counterparty?: string; proveedor?: string }): string => {
  return input.counterparty || input.proveedor || '';
};