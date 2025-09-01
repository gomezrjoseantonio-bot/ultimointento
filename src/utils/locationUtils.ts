// Spanish postal code to location mapping utilities

export interface LocationData {
  province: string;
  ccaa: string;
  municipalities: string[];
}

// CCAA list with ITP rates (tipo general)
export const CCAA_LIST = [
  { name: 'Andalucía', itpRate: 8.0 },
  { name: 'Aragón', itpRate: 8.0 },
  { name: 'Asturias', itpRate: 8.0 },
  { name: 'Baleares', itpRate: 8.0 },
  { name: 'Canarias', itpRate: 6.5 },
  { name: 'Cantabria', itpRate: 8.0 },
  { name: 'Castilla-La Mancha', itpRate: 9.0 },
  { name: 'Castilla y León', itpRate: 8.0 },
  { name: 'Cataluña', itpRate: 10.0 },
  { name: 'Ceuta', itpRate: 6.0 },
  { name: 'Extremadura', itpRate: 8.0 },
  { name: 'Galicia', itpRate: 10.0 },
  { name: 'La Rioja', itpRate: 7.0 },
  { name: 'Madrid', itpRate: 6.0 },
  { name: 'Melilla', itpRate: 6.0 },
  { name: 'Murcia', itpRate: 8.0 },
  { name: 'Navarra', itpRate: 6.0 },
  { name: 'País Vasco', itpRate: 4.0 },
  { name: 'Valencia', itpRate: 10.0 }
];

// Basic postal code to location mapping (sample data)
const POSTAL_CODE_MAP: Record<string, LocationData> = {
  // Madrid
  '28001': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28002': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28003': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28004': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28005': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28006': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28007': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28008': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28009': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28010': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  
  // Barcelona
  '08001': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08002': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08003': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08004': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08005': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  
  // Valencia
  '46001': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46002': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46003': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46004': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46005': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  
  // Sevilla
  '41001': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41002': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41003': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41004': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41005': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  
  // Asturias - Oviedo (for testing)
  '33001': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33002': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33003': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33004': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33005': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  
  // Cantabria - Santander
  '39001': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39002': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39003': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39004': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39005': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
};

export const getLocationFromPostalCode = (postalCode: string): LocationData | null => {
  const cleanCode = postalCode.replace(/\s/g, '');
  if (cleanCode.length !== 5 || !/^\d{5}$/.test(cleanCode)) {
    return null;
  }
  
  return POSTAL_CODE_MAP[cleanCode] || null;
};

export const validatePostalCode = (postalCode: string): boolean => {
  const cleanCode = postalCode.replace(/\s/g, '');
  return cleanCode.length === 5 && /^\d{5}$/.test(cleanCode);
};

export const getITPRateForCCAA = (ccaa: string): number => {
  const ccaaData = CCAA_LIST.find(c => c.name.toLowerCase() === ccaa.toLowerCase());
  return ccaaData?.itpRate || 8.0; // Default to 8% if not found
};

export const calculateITP = (price: number, ccaa: string): number => {
  const rate = getITPRateForCCAA(ccaa);
  return price * (rate / 100);
};

export const formatCadastralReference = (ref: string): string => {
  // Normalize to uppercase, remove spaces, max 20 chars
  return ref.toUpperCase().replace(/\s/g, '').substring(0, 20);
};