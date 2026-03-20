import { initDB } from './db';

export interface ObjetivosFinancieros {
  id: 1;
  rentaPasivaObjetivo: number;
  patrimonioNetoObjetivo: number;
  cajaMinima: number;
  dtiMaximo: number;
  ltvMaximo: number;
  yieldMinimaCartera: number;
  tasaAhorroMinima: number;
  updatedAt: string;
}

const DEFAULTS: ObjetivosFinancieros = {
  id: 1,
  rentaPasivaObjetivo: 3_000,
  patrimonioNetoObjetivo: 600_000,
  cajaMinima: 10_000,
  dtiMaximo: 35,
  ltvMaximo: 50,
  yieldMinimaCartera: 8,
  tasaAhorroMinima: 15,
  updatedAt: new Date().toISOString(),
};

export async function getObjetivos(): Promise<ObjetivosFinancieros> {
  try {
    const db = await initDB();
    const existing = await db.get('objetivos_financieros', 1).catch(() => null);
    return (existing as ObjetivosFinancieros | null) ?? DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function saveObjetivos(
  partial: Partial<Omit<ObjetivosFinancieros, 'id' | 'updatedAt'>>,
): Promise<ObjetivosFinancieros> {
  const db = await initDB();
  const current = await getObjetivos();
  const updated: ObjetivosFinancieros = {
    ...current,
    ...partial,
    id: 1,
    updatedAt: new Date().toISOString(),
  };

  await db.put('objetivos_financieros', updated);
  return updated;
}

export async function resetObjetivos(): Promise<ObjetivosFinancieros> {
  const db = await initDB();
  const reset = { ...DEFAULTS, updatedAt: new Date().toISOString() };
  await db.put('objetivos_financieros', reset);
  return reset;
}
