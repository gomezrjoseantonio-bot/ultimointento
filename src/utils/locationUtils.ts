// Spanish postal code to location mapping utilities
import { multiplyCurrency, roundCurrency } from './formatUtils';

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

// Basic postal code to location mapping (expanded data)
const POSTAL_CODE_MAP: Record<string, LocationData> = {
  // Madrid (28xxx)
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
  '28011': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28012': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28013': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28014': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28015': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28016': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28017': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28018': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28019': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28020': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28021': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28022': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28023': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28024': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28025': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28026': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28027': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28028': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28029': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28030': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28031': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28032': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28033': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28034': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28035': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28036': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28037': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28038': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28039': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28040': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28041': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28042': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28043': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28044': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28045': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28046': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28047': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28048': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28049': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  '28050': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Madrid'] },
  // Alcalá de Henares
  '28801': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28802': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28803': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28804': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28805': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28806': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  '28807': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Alcalá de Henares'] },
  // Móstoles
  '28931': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28932': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28933': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28934': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28935': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28936': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28937': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28938': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  '28939': { province: 'Madrid', ccaa: 'Madrid', municipalities: ['Móstoles'] },
  
  // Barcelona (08xxx)
  '08001': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08002': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08003': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08004': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08005': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08006': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08007': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08008': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08009': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08010': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08011': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08012': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08013': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08014': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08015': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08016': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08017': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08018': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08019': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08020': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08021': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08022': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08023': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08024': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08025': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08026': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08027': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08028': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08029': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08030': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08031': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08032': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08033': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08034': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08035': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08036': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08037': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08038': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08039': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  '08040': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Barcelona'] },
  // L'Hospitalet de Llobregat
  '08901': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['L\'Hospitalet de Llobregat'] },
  '08902': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['L\'Hospitalet de Llobregat'] },
  '08903': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['L\'Hospitalet de Llobregat'] },
  '08904': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['L\'Hospitalet de Llobregat'] },
  '08905': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['L\'Hospitalet de Llobregat'] },
  // Badalona
  '08911': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  '08912': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  '08913': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  '08914': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  '08915': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  '08916': { province: 'Barcelona', ccaa: 'Cataluña', municipalities: ['Badalona'] },
  
  // Valencia (46xxx)
  '46001': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46002': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46003': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46004': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46005': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46006': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46007': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46008': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46009': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46010': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46011': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46012': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46013': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46014': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46015': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46016': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46017': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46018': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46019': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46020': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46021': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46022': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46023': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46024': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  '46025': { province: 'Valencia', ccaa: 'Valencia', municipalities: ['Valencia'] },
  
  // Sevilla (41xxx)
  '41001': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41002': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41003': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41004': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41005': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41006': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41007': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41008': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41009': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41010': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41011': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41012': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41013': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41014': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41015': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41016': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41017': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41018': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41019': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41020': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Sevilla'] },
  '41940': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Tomares'] },
  '41950': { province: 'Sevilla', ccaa: 'Andalucía', municipalities: ['Castilleja de la Cuesta'] },
  
  // Asturias - Oviedo (33xxx)
  '33001': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33002': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33003': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33004': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33005': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33006': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33007': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33008': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33009': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33010': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33011': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33012': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  '33013': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Oviedo'] },
  // Gijón
  '33201': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33202': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33203': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33204': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33205': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33206': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33207': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33208': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33209': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33210': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33211': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33212': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33213': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  '33214': { province: 'Asturias', ccaa: 'Asturias', municipalities: ['Gijón'] },
  
  // Cantabria - Santander (39xxx)
  '39001': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39002': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39003': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39004': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39005': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39006': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39007': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39008': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39009': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39010': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39011': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
  '39012': { province: 'Cantabria', ccaa: 'Cantabria', municipalities: ['Santander'] },
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
  return roundCurrency(multiplyCurrency(price, rate / 100));
};

export const formatCadastralReference = (ref: string): string => {
  // Normalize to uppercase, remove spaces, max 20 chars
  return ref.toUpperCase().replace(/\s/g, '').substring(0, 20);
};

export const calculateIVA = (price: number): number => {
  // Standard IVA rate for new construction is 10%
  return roundCurrency(multiplyCurrency(price, 0.10));
};

export const getSpecialRegionWarning = (ccaa: string): string | null => {
  const ccaaLower = ccaa.toLowerCase();
  
  if (ccaaLower === 'canarias') {
    return 'En Canarias aplica IGIC (no IVA). Ajusta el importe si procede.';
  }
  
  if (ccaaLower === 'ceuta' || ccaaLower === 'melilla') {
    return 'En Ceuta/Melilla aplica IPSI. Ajusta el importe si procede.';
  }
  
  return null;
};