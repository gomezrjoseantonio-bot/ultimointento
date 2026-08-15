/* municipioLookup · resuelve el municipio a partir del código postal.
   El dataset completo (~11k CP → municipio, INE) se carga de forma perezosa
   mediante import dinámico para no engordar el bundle inicial. */

let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

async function loadDataset(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!loading) {
    loading = import('./cpMunicipios.json').then((mod) => {
      cache = (mod.default ?? mod) as Record<string, string>;
      return cache;
    });
  }
  return loading;
}

/** Municipio para un CP de 5 dígitos, o null si no está en el dataset. */
export async function getMunicipioFromPostalCode(postalCode: string): Promise<string | null> {
  const cp = postalCode.replace(/\s/g, '');
  if (!/^\d{5}$/.test(cp)) return null;
  const data = await loadDataset();
  return data[cp] ?? null;
}
