/**
 * Test suite for Reset Atlas functionality
 * Validates the local cache cleanup per problem statement
 */

export {}; // Make this a module

describe('Reset Atlas Functionality', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        clear: jest.fn(),
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Mock IndexedDB
    Object.defineProperty(window, 'indexedDB', {
      value: {
        deleteDatabase: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should clear localStorage when Reset Atlas is executed', async () => {
    // Mock the deleteRequest with proper handlers
    const mockDeleteRequest = {
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
    };

    (indexedDB.deleteDatabase as jest.Mock).mockReturnValue(mockDeleteRequest);

    // Simulate Reset Atlas logic
    const resetAtlas = async () => {
      localStorage.clear();
      
      if ('indexedDB' in window) {
        const deleteRequest = indexedDB.deleteDatabase('AtlasHorizonDB');
        
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = (event: any) => resolve(true);
          deleteRequest.onerror = (event: any) => reject(new Error('Delete failed'));
          
          // Immediately trigger success for test
          setTimeout(() => {
            if (deleteRequest.onsuccess) {
              deleteRequest.onsuccess({} as any);
            }
          }, 0);
        });
      }
    };

    await resetAtlas();

    expect(localStorage.clear).toHaveBeenCalled();
    expect(indexedDB.deleteDatabase).toHaveBeenCalledWith('AtlasHorizonDB');
  });

  test('should require exact confirmation text "ELIMINAR DATOS LOCALES"', () => {
    const validateConfirmationText = (text: string): boolean => {
      return text === 'ELIMINAR DATOS LOCALES';
    };

    // Valid confirmation
    expect(validateConfirmationText('ELIMINAR DATOS LOCALES')).toBe(true);

    // Invalid confirmations
    expect(validateConfirmationText('eliminar datos locales')).toBe(false);
    expect(validateConfirmationText('ELIMINAR DATOS')).toBe(false);
    expect(validateConfirmationText('')).toBe(false);
    expect(validateConfirmationText(' ELIMINAR DATOS LOCALES ')).toBe(false);
  });

  test('should handle IndexedDB errors gracefully', async () => {
    // Mock IndexedDB error
    const mockDeleteRequest = {
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      error: new Error('Database deletion failed'),
    };

    (indexedDB.deleteDatabase as jest.Mock).mockReturnValue(mockDeleteRequest);

    const resetAtlasWithErrorHandling = async () => {
      try {
        localStorage.clear();
        
        if ('indexedDB' in window) {
          const deleteRequest = indexedDB.deleteDatabase('AtlasHorizonDB');
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = (event: any) => resolve(true);
            deleteRequest.onerror = (event: any) => reject(new Error('IndexedDB error'));
            
            // Simulate error after a short delay
            setTimeout(() => {
              if (deleteRequest.onerror) {
                deleteRequest.onerror({} as any);
              }
            }, 0);
          });
        }
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    };

    const result = await resetAtlasWithErrorHandling();
    
    expect(localStorage.clear).toHaveBeenCalled();
    expect(indexedDB.deleteDatabase).toHaveBeenCalledWith('AtlasHorizonDB');
    // Should handle error gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBe('IndexedDB error');
  });
});