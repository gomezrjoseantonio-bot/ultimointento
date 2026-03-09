// H-OCR-FIX: Provider Directory Service for managing canonical provider names

// H-OCR-FIX: Provider directory entry interface
export interface ProviderDirectoryEntry {
  id?: number;
  canonicalName: string;
  nif?: string;
  aliases: string[]; // Comma-separated aliases
  createdAt: string;
  updatedAt: string;
}

// H-OCR-FIX: Get all provider directory entries
export const getAllProviders = async (): Promise<ProviderDirectoryEntry[]> => {
  try {
    // For now, use localStorage until we add the store to db.ts
    const stored = localStorage.getItem('provider-directory');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Error loading provider directory:', error);
    return [];
  }
};

// H-OCR-FIX: Add or update provider in directory
export const saveProvider = async (provider: Omit<ProviderDirectoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  try {
    const providers = await getAllProviders();
    const now = new Date().toISOString();
    
    const newProvider: ProviderDirectoryEntry = {
      ...provider,
      id: Date.now(), // Simple ID generation for localStorage
      createdAt: now,
      updatedAt: now
    };
    
    providers.push(newProvider);
    localStorage.setItem('provider-directory', JSON.stringify(providers));
    
    return newProvider.id!; // We just assigned it above
  } catch (error) {
    console.error('Error saving provider:', error);
    throw new Error('No se pudo guardar el proveedor. Verifica que el nombre sea único y los datos sean correctos.');
  }
};

// H-OCR-FIX: Update existing provider
export const updateProvider = async (id: number, updates: Partial<ProviderDirectoryEntry>): Promise<void> => {
  try {
    const providers = await getAllProviders();
    const index = providers.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error('Proveedor no encontrado. Es posible que haya sido eliminado.');
    }
    
    providers[index] = {
      ...providers[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('provider-directory', JSON.stringify(providers));
  } catch (error) {
    console.error('Error updating provider:', error);
    throw new Error('No se pudo actualizar el proveedor. Verifica que los datos sean válidos e intenta nuevamente.');
  }
};

// H-OCR-FIX: Delete provider from directory
export const deleteProvider = async (id: number): Promise<void> => {
  try {
    const providers = await getAllProviders();
    const filtered = providers.filter(p => p.id !== id);
    localStorage.setItem('provider-directory', JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting provider:', error);
    throw new Error('No se pudo eliminar el proveedor. Intenta recargar la página y volver a intentarlo.');
  }
};

// H-OCR-FIX: Search provider by NIF in directory
export const findProviderByNIF = async (nif: string): Promise<ProviderDirectoryEntry | null> => {
  try {
    const providers = await getAllProviders();
    return providers.find(p => p.nif === nif) || null;
  } catch (error) {
    console.error('Error searching provider by NIF:', error);
    return null;
  }
};

// H-OCR-FIX: Search provider by name or alias
export const findProviderByNameOrAlias = async (name: string): Promise<ProviderDirectoryEntry | null> => {
  try {
    const providers = await getAllProviders();
    const searchName = name.toLowerCase().trim();
    
    return providers.find(p => 
      p.canonicalName.toLowerCase().includes(searchName) ||
      p.aliases.some(alias => alias.toLowerCase().includes(searchName))
    ) || null;
  } catch (error) {
    console.error('Error searching provider by name:', error);
    return null;
  }
};

// H-OCR-FIX: Initialize with default Spanish utility providers
export const initializeDefaultProviders = async (): Promise<void> => {
  const existing = await getAllProviders();
  if (existing.length > 0) return; // Already initialized
  
  const defaultProviders: Omit<ProviderDirectoryEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      canonicalName: 'ENDESA',
      nif: 'A81948077',
      aliases: ['Endesa Energía XXI', 'Endesa Energía', 'ENDESA ENERGIA', 'Endesa S.A.']
    },
    {
      canonicalName: 'EDP',
      nif: 'A83052407',
      aliases: ['EDP Energía', 'EDP España', 'EDP Comercializadora']
    },
    {
      canonicalName: 'NATURGY',
      nif: 'A08015497',
      aliases: ['Naturgy Energy Group', 'Gas Natural Fenosa', 'Naturgy Iberia']
    },
    {
      canonicalName: 'REPSOL',
      nif: 'A28129274',
      aliases: ['Repsol Comercializadora', 'Repsol Gas']
    },
    {
      canonicalName: 'HOLALUZ',
      nif: 'B65443077',
      aliases: ['Holaluz Energía', 'HOLALUZ-CLIDOM']
    },
    {
      canonicalName: 'TOTALENERGIES',
      nif: 'A83131396',
      aliases: ['TotalEnergies Gas y Electricidad España', 'Total Energies']
    },
    {
      canonicalName: 'IBERDROLA',
      nif: 'A95075578',
      aliases: ['Iberdrola Clientes', 'Iberdrola Comercializacion']
    }
  ];
  
  for (const provider of defaultProviders) {
    await saveProvider(provider);
  }
};