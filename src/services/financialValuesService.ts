import { initDB } from './db';
import { getAllCartaItems } from '../modules/inversiones/adapters/galeriaAdapter';
import { planesPensionesService } from './planesPensionesService';
import { upsertByDate } from './valoracionesService';
import type { Property } from './db';
import type {
  FinancialValuationItem,
  FinancialValuesSnapshot,
  SaveFinancialValuesInput,
} from '../types/financialValues';

const STORAGE_KEY = 'financialValuesSnapshot';

export const FINANCIAL_VALUES_UPDATED_EVENT = 'atlas:financial-values-updated';

type PersistedFinancialValues = Omit<FinancialValuesSnapshot, 'updatedAt'> & {
  updatedAt: string;
};

interface FinancialValuesRepository {
  read(): Promise<PersistedFinancialValues | null>;
  write(snapshot: PersistedFinancialValues): Promise<void>;
}

const localFinancialValuesRepository: FinancialValuesRepository = {
  async read() {
    try {
      const db = await initDB();
      const data = (await db.get('keyval', STORAGE_KEY)) as PersistedFinancialValues | undefined;
      if (!data) return null;
      return data;
    } catch {
      return null;
    }
  },
  async write(snapshot) {
    const db = await initDB();
    await db.put('keyval', snapshot as never, STORAGE_KEY);
  },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeList = (items: FinancialValuationItem[]): FinancialValuationItem[] =>
  items
    .filter((item) => item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: item.name.trim(),
      value: toNumber(item.value),
    }));

const resolvePropertyValue = (property: Property & Record<string, unknown>): number =>
  toNumber(
    property.valor_actual
      ?? property.currentValue
      ?? property.marketValue
      ?? property.estimatedValue
      ?? property.valuation
      ?? (property.compra as { valor_actual?: number } | undefined)?.valor_actual
      ?? (property.acquisitionCosts as { currentValue?: number } | undefined)?.currentValue
      ?? property.acquisitionCosts?.price
      ?? 0,
  );

const mergeValuations = (
  liveItems: FinancialValuationItem[],
  storedItems: FinancialValuationItem[] | undefined,
): FinancialValuationItem[] => {
  const storedMap = new Map((storedItems ?? []).map((item) => [String(item.id), item]));
  return liveItems.map((item) => {
    const stored = storedMap.get(item.id);
    return stored ? { ...item, value: toNumber(stored.value, item.value) } : item;
  });
};

function emitFinancialValuesUpdated(snapshot: FinancialValuesSnapshot): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(FINANCIAL_VALUES_UPDATED_EVENT, {
      detail: snapshot,
    }),
  );
}

export function subscribeFinancialValuesUpdated(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(FINANCIAL_VALUES_UPDATED_EVENT, listener);
  return () => window.removeEventListener(FINANCIAL_VALUES_UPDATED_EVENT, listener);
}

export async function getFinancialValuesSnapshot(): Promise<FinancialValuesSnapshot> {
  const [db, stored, investmentItems] = await Promise.all([
    initDB(),
    localFinancialValuesRepository.read(),
    getAllCartaItems().catch(() => []),
  ]);

  const properties = ((await db.getAll('properties')) as Property[])
    .filter((property) => property.id != null && property.state !== 'vendido' && property.state !== 'baja');

  const liveRealEstate = properties.map((property) => ({
    id: String(property.id),
    name: property.alias || property.address || `Inmueble ${property.id}`,
    value: resolvePropertyValue(property as Property & Record<string, unknown>),
  }));

  const liveInvestments = investmentItems.map((item) => ({
    id: String(item._idOriginal),
    name: item.nombre,
    value: toNumber(item.valor_actual),
  }));

  return {
    ipcMonthlyPercent:
      typeof stored?.ipcMonthlyPercent === 'number' ? stored.ipcMonthlyPercent : null,
    euriborPercent:
      typeof stored?.euriborPercent === 'number' ? stored.euriborPercent : null,
    effectiveDate: stored?.effectiveDate || todayISO(),
    realEstateValuations: mergeValuations(liveRealEstate, stored?.realEstateValuations),
    investmentValuations: mergeValuations(liveInvestments, stored?.investmentValuations),
    updatedAt: stored?.updatedAt ?? null,
  };
}

async function syncRealEstateValues(
  items: FinancialValuationItem[],
  effectiveDate: string,
): Promise<void> {
  if (items.length === 0) return;
  const db = await initDB();
  const allProperties = (await db.getAll('properties')) as Array<Property & Record<string, unknown>>;
  const propertyMap = new Map(
    allProperties
      .filter((property) => property.id != null)
      .map((property) => [String(property.id), property]),
  );

  await Promise.all(
    items.map(async (item) => {
      const property = propertyMap.get(String(item.id));
      if (!property) return;
      await db.put('properties', {
        ...property,
        valor_actual: item.value,
      } as never);
      await upsertByDate({
        activoId: String(item.id),
        tipoActivo: 'inmueble',
        fecha: effectiveDate,
        valor: item.value,
        origen: 'manual',
        notas: 'Panel · Actualizar valores',
      });
    }),
  );
}

async function syncInvestmentValues(
  items: FinancialValuationItem[],
  effectiveDate: string,
): Promise<void> {
  if (items.length === 0) return;
  const [db, liveItems] = await Promise.all([initDB(), getAllCartaItems().catch(() => [])]);
  const liveMap = new Map(liveItems.map((item) => [String(item._idOriginal), item]));

  await Promise.all(
    items.map(async (item) => {
      const liveItem = liveMap.get(String(item.id));
      if (!liveItem) return;

      if (liveItem._origen === 'planesPensiones') {
        await planesPensionesService.updatePlan(String(item.id), {
          valorActual: item.value,
          fechaUltimaValoracion: effectiveDate,
        });
        await upsertByDate({
          activoId: String(item.id),
          tipoActivo: 'plan_pensiones',
          fecha: effectiveDate,
          valor: item.value,
          origen: 'manual',
          notas: 'Panel · Actualizar valores',
        });
        return;
      }

      const existing = await db.get('inversiones', Number(item.id));
      if (!existing) return;
      await db.put('inversiones', {
        ...(existing as unknown as Record<string, unknown>),
        valor_actual: item.value,
        fecha_valoracion: effectiveDate,
        updated_at: new Date().toISOString(),
      } as never);
      await upsertByDate({
        activoId: String(item.id),
        tipoActivo: 'inversion',
        fecha: effectiveDate,
        valor: item.value,
        origen: 'manual',
        notas: 'Panel · Actualizar valores',
      });
    }),
  );
}

export async function saveFinancialValuesSnapshot(
  input: SaveFinancialValuesInput,
): Promise<FinancialValuesSnapshot> {
  const effectiveDate = input.effectiveDate || todayISO();
  const now = new Date().toISOString();
  const snapshot: FinancialValuesSnapshot = {
    ipcMonthlyPercent:
      typeof input.ipcMonthlyPercent === 'number' ? input.ipcMonthlyPercent : null,
    euriborPercent: typeof input.euriborPercent === 'number' ? input.euriborPercent : null,
    effectiveDate,
    realEstateValuations: normalizeList(input.realEstateValuations),
    investmentValuations: normalizeList(input.investmentValuations),
    updatedAt: now,
  };

  await Promise.all([
    localFinancialValuesRepository.write({
      ...snapshot,
      updatedAt: now,
    }),
    syncRealEstateValues(snapshot.realEstateValuations, effectiveDate),
    syncInvestmentValues(snapshot.investmentValuations, effectiveDate),
  ]);

  emitFinancialValuesUpdated(snapshot);
  return snapshot;
}
