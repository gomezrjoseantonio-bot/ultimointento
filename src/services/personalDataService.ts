import { initDB } from './db';
import { 
  PersonalData, 
  PersonalModuleConfig, 
  SituacionLaboral 
} from '../types/personal';

class PersonalDataService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get personal data for the current user
   * For now, we'll use a single user model
   */
  async getPersonalData(): Promise<PersonalData | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['personalData'], 'readonly');
      const store = transaction.objectStore('personalData');
      const data = await store.get(1); // Single user for now
      return data || null;
    } catch (error) {
      console.error('Error getting personal data:', error);
      return null;
    }
  }

  /**
   * Save or update personal data
   */
  async savePersonalData(data: Omit<PersonalData, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<PersonalData> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['personalData'], 'readwrite');
      const store = transaction.objectStore('personalData');
      
      const existingData = await store.get(1);
      const now = new Date().toISOString();
      
      const personalData: PersonalData = {
        id: 1,
        ...data,
        fechaCreacion: existingData?.fechaCreacion || now,
        fechaActualizacion: now
      };

      await store.put(personalData);
      await transaction.complete;
      
      // Update module configuration based on situacion laboral
      await this.updateModuleConfiguration(personalData);
      
      return personalData;
    } catch (error) {
      console.error('Error saving personal data:', error);
      throw error;
    }
  }

  /**
   * Get module configuration based on personal data
   */
  async getModuleConfiguration(): Promise<PersonalModuleConfig | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['personalModuleConfig'], 'readonly');
      const store = transaction.objectStore('personalModuleConfig');
      const config = await store.get(1);
      return config || null;
    } catch (error) {
      console.error('Error getting module configuration:', error);
      return null;
    }
  }

  /**
   * Update module configuration based on personal data
   */
  private async updateModuleConfiguration(personalData: PersonalData): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['personalModuleConfig'], 'readwrite');
      const store = transaction.objectStore('personalModuleConfig');
      
      const seccionesActivas = {
        nomina: personalData.situacionLaboral.includes('asalariado'),
        autonomo: personalData.situacionLaboral.includes('autonomo'),
        pensionesInversiones: true, // Always available
        otrosIngresos: true // Always available
      };

      const config: PersonalModuleConfig = {
        personalDataId: personalData.id!,
        seccionesActivas,
        integracionTesoreria: true,
        integracionProyecciones: true,
        integracionFiscalidad: true,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(config);
      await transaction.complete;
    } catch (error) {
      console.error('Error updating module configuration:', error);
      throw error;
    }
  }

  /**
   * Check if personal data is configured
   */
  async isPersonalDataConfigured(): Promise<boolean> {
    const data = await this.getPersonalData();
    return data !== null && 
           !!data.nombre && 
           !!data.apellidos && 
           !!data.dni && 
           data.situacionLaboral.length > 0;
  }

  /**
   * Get active sections based on current configuration
   */
  async getActiveSections(): Promise<string[]> {
    const config = await this.getModuleConfiguration();
    if (!config) return [];

    const activeSections: string[] = [];
    if (config.seccionesActivas.nomina) activeSections.push('nomina');
    if (config.seccionesActivas.autonomo) activeSections.push('autonomo');
    if (config.seccionesActivas.pensionesInversiones) activeSections.push('pensiones-inversiones');
    if (config.seccionesActivas.otrosIngresos) activeSections.push('otros-ingresos');

    return activeSections;
  }

  /**
   * Validate situacion laboral combination
   */
  validateSituacionLaboral(situaciones: SituacionLaboral[]): { isValid: boolean; error?: string } {
    if (situaciones.length === 0) {
      return { isValid: false, error: 'Debe seleccionar al menos una situación laboral' };
    }

    // Check for incompatible combinations
    if (situaciones.includes('desempleado') && situaciones.length > 1) {
      return { isValid: false, error: 'La situación "Desempleado" no puede combinarse con otras' };
    }

    if (situaciones.includes('jubilado') && situaciones.length > 1) {
      return { isValid: false, error: 'La situación "Jubilado" no puede combinarse con otras' };
    }

    return { isValid: true };
  }
}

export const personalDataService = new PersonalDataService();