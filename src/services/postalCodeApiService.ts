// Postal Code API Service - infrastructure prepared for future external API integration
// Possible APIs: GeoNames (https://www.geonames.org/), INE API, Correos API

export interface PostalCodeApiResponse {
  postalCode: string;
  municipality: string;
  province: string;
  ccaa: string;
  source: 'api' | 'cache';
}

/**
 * Fetch location data for a postal code from an external API.
 * Currently returns null as a stub — implement with a real API when available.
 *
 * TODO: Implement with one of:
 *   - GeoNames: https://api.geonames.org/postalCodeSearchJSON?postalcode={cp}&country=ES&username=demo
 *   - INE API: https://servicios.ine.es/wstempus/js/ES/MUNICIPIOS_POR_CP/{cp}
 *   - Correos API (requires credentials)
 */
export async function fetchLocationFromAPI(postalCode: string): Promise<PostalCodeApiResponse | null> {
  // TODO: Implement external API call
  return null;
}
