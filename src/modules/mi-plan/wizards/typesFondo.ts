// T27.3 · tipos internos del wizard "Crear Nuevo Fondo de Ahorro".
// Mantiene una representación PLANA del draft mientras el usuario rellena.
// Al confirmar se mapea al shape persistido `FondoAhorro` (V67) en
// `WizardNuevoFondo.tsx`.
//
// IMPORTANTE: el wizard expone solo 4 categorías al usuario (`colchon` ·
// `compra` (label "Próxima compra") · `reforma` · `impuestos`). El shape
// persistido del repo permite también `capricho` y `custom` para edición
// avanzada futura · NO los exponemos en este wizard.

import type { FondoTipo, FondoPrioridad } from '../../../types/miPlan';

export type CategoriaFondo = Extract<
  FondoTipo,
  'colchon' | 'compra' | 'reforma' | 'impuestos'
>;

// Asignación parcial fija a una cuenta · el wizard solo crea este modo
// (decisión Etapa A · respeta el shape · evita la complejidad de los
// modos `completo` y `parcial porcentaje` que el shape también soporta).
export interface CuentaAsignacionDraft {
  cuentaId: number;
  importeAsignado: number;
}

export interface FondoDraft {
  categoria?: CategoriaFondo;

  nombre: string;

  // Meta común
  metaImporte: string; // input string · se valida a number al confirmar
  fechaObjetivoMes: number; // 1-12
  fechaObjetivoAnio: number;
  prioridad: FondoPrioridad;

  // Variante 'colchon'
  colchonMeses: string;          // string para input
  colchonGastoMensual: string;   // string para input

  // Cuentas · solo modo parcial fijo
  cuentasAsignadas: CuentaAsignacionDraft[];

  // Capacidad de ahorro mensual · input manual T27.3 · auto-cálculo en T8
  capacidadAhorroMensual: string;

  // Vinculación opcional con un objetivo
  objetivoVinculadoId?: string;
  // Modo "sin vincular" explícito · diferencia entre "no he elegido" y
  // "he elegido no vincular" para validación step 4.
  vinculoElegido: boolean;
}

export const draftInicialFondo = (): FondoDraft => ({
  categoria: undefined,
  nombre: '',
  metaImporte: '',
  fechaObjetivoMes: 12,
  fechaObjetivoAnio: new Date().getFullYear() + 2,
  prioridad: 'alta',
  colchonMeses: '24',
  colchonGastoMensual: '',
  cuentasAsignadas: [],
  capacidadAhorroMensual: '',
  objetivoVinculadoId: undefined,
  vinculoElegido: false,
});

// Acepta "80.000" (formato es-ES) y "80000" · idéntico al wizard objetivo.
export const parseImporte = (s: string): number => {
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

// Mes/año → ISO YYYY-MM-01.
export const buildFechaIso = (mes: number, anio: number): string =>
  `${anio}-${String(mes).padStart(2, '0')}-01`;

// Etiqueta UI para una `CategoriaFondo` (decisión Etapa A · `compra` interno
// se muestra como "Próxima compra" en UI por afinidad con el prototipo HTML).
export const labelCategoria = (cat: CategoriaFondo | undefined): string => {
  if (!cat) return '';
  if (cat === 'colchon') return 'Colchón de emergencia';
  if (cat === 'compra') return 'Próxima compra';
  if (cat === 'reforma') return 'Reforma prevista';
  return 'Impuestos pendientes';
};

// Calcula la meta total para `colchon` · meses × gastoMensual.
export const calcularMetaColchon = (draft: FondoDraft): number => {
  const meses = parseImporte(draft.colchonMeses);
  const gasto = parseImporte(draft.colchonGastoMensual);
  return Math.round(meses * gasto);
};
