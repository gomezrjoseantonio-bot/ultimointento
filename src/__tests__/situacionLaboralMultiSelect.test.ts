/**
 * Tests for multi-select employment status (situacionLaboral) logic.
 * Validates that the service correctly allows simultaneous active statuses
 * (e.g., asalariado + autonomo) while keeping exclusive statuses isolated.
 */

import { personalDataService } from '../services/personalDataService';
import { SituacionLaboral } from '../types/personal';

// Mock IndexedDB since the service uses it
const mockDB = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
};

jest.mock('../services/db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

describe('SituacionLaboral - Multi-Select Validation', () => {
  describe('validateSituacionLaboral', () => {
    it('should reject empty selection', () => {
      const result = personalDataService.validateSituacionLaboral([]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should allow asalariado alone', () => {
      const result = personalDataService.validateSituacionLaboral(['asalariado']);
      expect(result.isValid).toBe(true);
    });

    it('should allow autonomo alone', () => {
      const result = personalDataService.validateSituacionLaboral(['autonomo']);
      expect(result.isValid).toBe(true);
    });

    it('should allow asalariado + autonomo simultaneously (pluriactividad)', () => {
      const result = personalDataService.validateSituacionLaboral(['asalariado', 'autonomo']);
      expect(result.isValid).toBe(true);
    });

    it('should reject desempleado combined with other statuses', () => {
      const result = personalDataService.validateSituacionLaboral(['desempleado', 'asalariado']);
      expect(result.isValid).toBe(false);
    });

    it('should allow desempleado alone', () => {
      const result = personalDataService.validateSituacionLaboral(['desempleado']);
      expect(result.isValid).toBe(true);
    });

    it('should reject jubilado combined with other statuses', () => {
      const result = personalDataService.validateSituacionLaboral(['jubilado', 'autonomo']);
      expect(result.isValid).toBe(false);
    });

    it('should allow jubilado alone', () => {
      const result = personalDataService.validateSituacionLaboral(['jubilado']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('UX auto-deselect logic', () => {
    // Simulates the handleSituacionLaboralChange logic from PersonalDataForm
    function applyChange(
      current: SituacionLaboral[],
      situacion: SituacionLaboral,
      checked: boolean
    ): SituacionLaboral[] {
      if (!checked) {
        return current.filter(s => s !== situacion);
      } else if (situacion === 'desempleado' || situacion === 'jubilado') {
        return [situacion];
      } else {
        const withoutExclusive = current.filter(
          s => s !== 'desempleado' && s !== 'jubilado'
        );
        return [...withoutExclusive, situacion];
      }
    }

    it('checking desempleado clears other selections', () => {
      const result = applyChange(['asalariado', 'autonomo'], 'desempleado', true);
      expect(result).toEqual(['desempleado']);
    });

    it('checking jubilado clears other selections', () => {
      const result = applyChange(['asalariado'], 'jubilado', true);
      expect(result).toEqual(['jubilado']);
    });

    it('checking asalariado while desempleado is active removes desempleado', () => {
      const result = applyChange(['desempleado'], 'asalariado', true);
      expect(result).toContain('asalariado');
      expect(result).not.toContain('desempleado');
    });

    it('checking autonomo while jubilado is active removes jubilado', () => {
      const result = applyChange(['jubilado'], 'autonomo', true);
      expect(result).toContain('autonomo');
      expect(result).not.toContain('jubilado');
    });

    it('allows asalariado + autonomo simultaneously', () => {
      const result = applyChange(['asalariado'], 'autonomo', true);
      expect(result).toContain('asalariado');
      expect(result).toContain('autonomo');
    });

    it('unchecking a status removes it from the list', () => {
      const result = applyChange(['asalariado', 'autonomo'], 'asalariado', false);
      expect(result).toEqual(['autonomo']);
    });

    it('result of auto-deselect is always valid per service validation', () => {
      const scenarios: Array<[SituacionLaboral[], SituacionLaboral, boolean]> = [
        [['asalariado', 'autonomo'], 'desempleado', true],
        [['desempleado'], 'asalariado', true],
        [['jubilado'], 'autonomo', true],
        [['asalariado'], 'jubilado', true],
        [['asalariado'], 'autonomo', true],
      ];

      for (const [current, situacion, checked] of scenarios) {
        const newSituaciones = applyChange(current, situacion, checked);
        const validation = personalDataService.validateSituacionLaboral(newSituaciones);
        expect(validation.isValid).toBe(true);
      }
    });
  });
});
