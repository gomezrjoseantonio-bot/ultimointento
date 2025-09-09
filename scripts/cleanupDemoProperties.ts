// H-CLEANUP: Cleanup Demo Properties Script
// Marks demo properties as deleted and removes demo data from destination selectors

import { initDB, Property } from '../src/services/db';

interface CleanupResult {
  demoPropertiesFound: number;
  demoPropertiesMarkedDeleted: number;
  errors: string[];
}

/**
 * Cleanup demo properties by marking them as deleted
 * This ensures they won't appear in destination selectors
 */
export async function cleanupDemoProperties(): Promise<CleanupResult> {
  const result: CleanupResult = {
    demoPropertiesFound: 0,
    demoPropertiesMarkedDeleted: 0,
    errors: []
  };

  try {
    const db = await initDB();
    const allProperties = await db.getAll('properties');
    
    console.log(`[CLEANUP] Found ${allProperties.length} total properties`);
    
    // Identify demo properties by common patterns
    const demoPatterns = [
      /demo/i,
      /ejemplo/i,
      /test/i,
      /prueba/i,
      /sample/i,
      /mayor.*123/i,  // "C/ Mayor 123" pattern
      /piso.*2a/i,    // "Piso 2A" pattern
      /ficticio/i,
      /plantilla/i
    ];

    for (const property of allProperties) {
      const isDemoProperty = demoPatterns.some(pattern => 
        pattern.test(property.alias) || 
        pattern.test(property.address) ||
        pattern.test(property.notes || '')
      );

      if (isDemoProperty) {
        result.demoPropertiesFound++;
        
        // Mark as 'baja' (deleted) instead of actually deleting
        if (property.state !== 'baja') {
          const updatedProperty: Property = {
            ...property,
            state: 'baja',
            notes: (property.notes || '') + ' [MARCADO COMO DEMO Y ELIMINADO]'
          };
          
          await db.put('properties', updatedProperty);
          result.demoPropertiesMarkedDeleted++;
          
          console.log(`[CLEANUP] Marked demo property as deleted: ${property.alias}`);
        }
      }
    }

    console.log(`[CLEANUP] Cleanup completed: ${result.demoPropertiesMarkedDeleted}/${result.demoPropertiesFound} demo properties marked as deleted`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    console.error('[CLEANUP] Error during cleanup:', error);
  }

  return result;
}

/**
 * Run cleanup if called directly
 */
if (require.main === module) {
  cleanupDemoProperties()
    .then(result => {
      console.log('Demo properties cleanup result:', result);
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Failed to cleanup demo properties:', error);
      process.exit(1);
    });
}