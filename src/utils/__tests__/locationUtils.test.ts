import {
  getLocationFromPostalCode,
  inferLocationFromPostalCodeRange,
  getProvinceFromPostalCode,
  getCCAAFromProvince,
} from '../locationUtils';

describe('inferLocationFromPostalCodeRange', () => {
  it('should infer Madrid from 28950', () => {
    const result = inferLocationFromPostalCodeRange('28950');
    expect(result?.province).toBe('Madrid');
    expect(result?.ccaa).toBe('Madrid');
    expect(result?.isInferred).toBe(true);
  });

  it('should infer Barcelona from 08700', () => {
    const result = inferLocationFromPostalCodeRange('08700');
    expect(result?.province).toBe('Barcelona');
    expect(result?.ccaa).toBe('Cataluña');
    expect(result?.isInferred).toBe(true);
  });

  it('should infer Sevilla from 41500', () => {
    const result = inferLocationFromPostalCodeRange('41500');
    expect(result?.province).toBe('Sevilla');
    expect(result?.ccaa).toBe('Andalucía');
  });

  it('should infer Valencia from 46900', () => {
    const result = inferLocationFromPostalCodeRange('46900');
    expect(result?.province).toBe('Valencia');
    expect(result?.ccaa).toBe('Valencia');
  });

  it('should return empty municipalities array', () => {
    const result = inferLocationFromPostalCodeRange('28950');
    expect(result?.municipalities).toEqual([]);
  });

  it('should return null for invalid postal code (99999)', () => {
    const result = inferLocationFromPostalCodeRange('99999');
    expect(result).toBeNull();
  });

  it('should return null for non-numeric postal code', () => {
    const result = inferLocationFromPostalCodeRange('ABCDE');
    expect(result).toBeNull();
  });

  it('should return null for short postal code', () => {
    const result = inferLocationFromPostalCodeRange('281');
    expect(result).toBeNull();
  });
});

describe('getLocationFromPostalCode', () => {
  it('should return exact match for known postal code (28001)', () => {
    const result = getLocationFromPostalCode('28001');
    expect(result?.province).toBe('Madrid');
    expect(result?.ccaa).toBe('Madrid');
    expect(result?.municipalities).toContain('Madrid');
  });

  it('should return null for unknown postal code not in map (28950)', () => {
    const result = getLocationFromPostalCode('28950');
    expect(result).toBeNull();
  });

  it('should return null for invalid postal code', () => {
    const result = getLocationFromPostalCode('99999');
    expect(result).toBeNull();
  });

  it('should return null for non-5-digit code', () => {
    const result = getLocationFromPostalCode('123');
    expect(result).toBeNull();
  });
});

describe('getProvinceFromPostalCode', () => {
  it('should return Madrid for 28xxx', () => {
    expect(getProvinceFromPostalCode('28001')).toBe('Madrid');
  });

  it('should return Asturias for 33xxx', () => {
    expect(getProvinceFromPostalCode('33999')).toBe('Asturias');
  });

  it('should return null for invalid prefix', () => {
    expect(getProvinceFromPostalCode('99000')).toBeNull();
  });
});

describe('getCCAAFromProvince', () => {
  it('should return Madrid for province Madrid', () => {
    expect(getCCAAFromProvince('Madrid')).toBe('Madrid');
  });

  it('should return Andalucía for province Sevilla', () => {
    expect(getCCAAFromProvince('Sevilla')).toBe('Andalucía');
  });

  it('should be case-insensitive', () => {
    expect(getCCAAFromProvince('madrid')).toBe('Madrid');
  });

  it('should return null for unknown province', () => {
    expect(getCCAAFromProvince('Desconocida')).toBeNull();
  });
});
