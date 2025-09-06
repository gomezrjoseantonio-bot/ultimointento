// Real Property Service - Replace hardcoded property data
// This service should connect to actual property database

export interface RealProperty {
  id: string;
  alias: string;
  address: string;
  cups?: string;
  status: 'active' | 'sold' | 'inactive';
  createdAt: string;
}

export class RealPropertyService {
  // In a real implementation, this would connect to your database
  // For now, we'll return empty array to fix the inconsistency
  static async getActiveProperties(): Promise<RealProperty[]> {
    // TODO: Replace with actual database query
    // const properties = await db.properties.findMany({ where: { status: 'active' } });
    
    // Return empty array until real properties are added
    return [];
  }

  static async getPropertyById(id: string): Promise<RealProperty | null> {
    // TODO: Replace with actual database query
    // return await db.properties.findUnique({ where: { id } });
    return null;
  }

  static async getPropertyByCUPS(cups: string): Promise<RealProperty | null> {
    // TODO: Replace with actual database query
    // return await db.properties.findFirst({ where: { cups } });
    return null;
  }

  // Method to detect property from address text
  static async detectPropertyFromAddress(addressText: string): Promise<RealProperty | null> {
    const properties = await this.getActiveProperties();
    
    // Try to match by partial address
    const normalizedAddress = addressText.toLowerCase().trim();
    return properties.find(p => 
      normalizedAddress.includes(p.address.toLowerCase()) ||
      normalizedAddress.includes(p.alias.toLowerCase())
    ) || null;
  }

  // Method to get properties for dropdown/selection
  static async getPropertiesForSelection(): Promise<Array<{value: string, label: string}>> {
    const properties = await this.getActiveProperties();
    return properties.map(p => ({
      value: p.id,
      label: `${p.alias} - ${p.address}`
    }));
  }
}

export const realPropertyService = new RealPropertyService();