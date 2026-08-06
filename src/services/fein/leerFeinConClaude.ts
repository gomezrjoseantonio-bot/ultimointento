// ============================================================================
// Leer una FEIN con Claude · VOCABULARIO §6 bis · quinquies
// ============================================================================
//
// La FEIN está normalizada en CONTENIDO por la Ley 5/2019 y **no en forma**
// *(Jose · 6 ago 2026: «hay mil FEIN, mil documentos distintos»)*. La de
// Unicaja tiene 9 páginas y numera «3. CARACTERÍSTICAS / 4. TIPO DE INTERÉS»;
// la del Santander tiene 16 y llama «3.- TIPO DE INTERÉS» a lo mismo.
//
// Por eso el camino anterior no servía. **Medido** sobre esas dos FEIN reales,
// la extracción por reglas sacaba:
//
//   · del Santander, **nada** — confianza global 0;
//   · de Unicaja, tres campos y **los tres mal**: `VARIABLE` en un mixto,
//     Euríbor a 6 meses cuando es a 12, y dos bonificaciones de 0,1 puntos
//     donde hay catorce bloques y el de haberes vale 0,5.
//
// Lo que hace falta no está en casillas, está en frases: «dividido por treinta
// y seis mil quinientos», «durante los primeros TREINTA Y SEIS MESES», «con una
// bonificación máxima de 1,00 p.p.». Eso lo lee un modelo de lenguaje.
//
// El PDF va entero y sin rasterizar: `chat.js` lo manda como bloque
// `document`, igual que ya hace con las facturas de la bandeja de entrada.
// ============================================================================

import { callScanChat } from '../scanChatService';
import type { FeinLoanDraft } from '../../types/fein';

/** Lo que devuelve el modo `scan_fein` · todo puede faltar, y eso es normal. */
export interface FeinLeida {
  banco?: string | null;
  capitalInicial?: number | null;
  plazoMeses?: number | null;
  fechaFirmaPrevista?: string | null;
  tipo?: 'FIJO' | 'VARIABLE' | 'MIXTO' | null;
  tinFijo?: number | null;
  tramoFijoMeses?: number | null;
  indiceReferencia?: 'EURIBOR' | 'IRPH' | null;
  valorIndiceActual?: number | null;
  diferencial?: number | null;
  revisionMeses?: 6 | 12 | null;
  baseCalculoIntereses?: '30/360' | 'ACT/360' | 'ACT/365' | null;
  comisionAperturaPct?: number | null;
  comisionMantenimientoMes?: number | null;
  amortizacionAnticipadaPct?: number | null;
  tasacion?: number | null;
  taeSinBonificaciones?: number | null;
  taeConBonificaciones?: number | null;
  cuotaEstimada?: number | null;
  importeTotalAReembolsar?: number | null;
  topeBonificacionPuntos?: number | null;
  bonificaciones?: Array<{ etiqueta?: string; puntos?: number; criterio?: string | null }>;
  notas?: string | null;
}

/**
 * Un número que vino del papel · el CERO también vino del papel.
 *
 * Dos trampas, las dos reales:
 *
 *   · `Number('')` es **0**, no `NaN`. Un campo vacío se habría colado como un
 *     cero, y aquí el cero es una afirmación —«exenta de comisión de apertura»—,
 *     así que habríamos convertido «no lo dice» en «dice que no hay».
 *   · Un importe español lleva el punto de los miles y la coma de los
 *     decimales: `97.905,83`. Cambiar solo la coma deja `97.905.83`, que es
 *     `NaN`. Se quitan los puntos de millar y luego la coma pasa a punto.
 *
 * Se exporta para poder fijarla con tests: es de las cosas que se rompen sin
 * hacer ruido.
 */
export const leido = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;

  const limpio = v.trim();
  if (!limpio) return undefined;

  const n = Number(limpio.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Un identificador estable para la bonificación, deducido de su etiqueta.
 *
 * La FEIN las nombra a su manera —«Bloque Haberes», «Bloque Seguro Vida Riesgo
 * Prima Anual»— y de ese nombre sale a qué se parece. Lo que no reconozca se
 * queda en `otros`: es honesto, y el usuario ve el nombre que puso su banco.
 */
export function idDeBonificacion(etiqueta: string): string {
  const t = etiqueta.toLowerCase();
  if (/n[óo]mina|haberes|ingreso/.test(t)) return 'nomina';
  if (/hogar|multirriesgo/.test(t)) return 'hogar';
  if (/vida|amortizaci[óo]n/.test(t)) return 'vida';
  if (/pension|previsi[óo]n/.test(t)) return 'pensiones';
  if (/tarjeta/.test(t)) return 'tarjeta';
  if (/recibo|domicili/.test(t)) return 'recibos';
  if (/alarma/.test(t)) return 'alarma';
  return 'otros';
}

/**
 * Lo leído, como el borrador que ya sabe llegar al formulario.
 *
 * Se separa de la llamada para poder probarlo sin red: lo que puede romperse
 * aquí es la traducción, no el HTTP.
 */
export function draftDesdeLeida(leida: FeinLeida, sourceFileName: string): FeinLoanDraft {
  const avisos: string[] = [];
  if (leida.notas) avisos.push(leida.notas);

  // Los números que el banco imprime para que cuadres: si están, se guardan
  // como aviso para poder contrastarlos con lo que ATLAS calcule. Un cuadro
  // que no reproduce la TAE de la propia FEIN es un cuadro que está mal.
  if (leido(leida.taeSinBonificaciones) !== undefined) {
    avisos.push(`La FEIN dice TAE ${leida.taeSinBonificaciones} % sin bonificaciones`);
  }
  if (leido(leida.importeTotalAReembolsar) !== undefined) {
    avisos.push(`y un total a reembolsar de ${leida.importeTotalAReembolsar} €`);
  }

  return {
    metadata: {
      sourceFileName,
      // El PDF va entero al modelo, así que no hay un recuento de páginas que
      // dar. Cero significa «no se contaron»; poner 1 sería afirmar que la FEIN
      // tiene una página, y ninguna la tiene.
      pagesTotal: 0,
      pagesProcessed: 0,
      ocrProvider: 'claude',
      processedAt: new Date().toISOString(),
      warnings: avisos,
    },
    prestamo: {
      tipo: leida.tipo ?? null,
      aliasSugerido: leida.banco ? `Préstamo ${leida.banco}` : undefined,
      capitalInicial: leido(leida.capitalInicial),
      plazoMeses: leido(leida.plazoMeses),
      periodicidadCuota: 'MENSUAL',
      revisionMeses: (leida.revisionMeses ?? null) as 6 | 12 | null,
      indiceReferencia: leida.indiceReferencia ?? null,
      valorIndiceActual: leido(leida.valorIndiceActual) ?? null,
      diferencial: leido(leida.diferencial) ?? null,
      tinFijo: leido(leida.tinFijo) ?? null,
      tramoFijoMeses: leido(leida.tramoFijoMeses) ?? null,
      baseCalculoIntereses: leida.baseCalculoIntereses ?? null,
      comisionAperturaPct: leido(leida.comisionAperturaPct) ?? null,
      comisionMantenimientoMes: leido(leida.comisionMantenimientoMes) ?? null,
      amortizacionAnticipadaPct: leido(leida.amortizacionAnticipadaPct) ?? null,
      tasacion: leido(leida.tasacion) ?? null,
      fechaFirmaPrevista: texto(leida.fechaFirmaPrevista) ?? null,
      banco: texto(leida.banco) ?? null,
      ibanCargoParcial: null,
    },
    bonificaciones: (leida.bonificaciones ?? [])
      // Una sin nombre no se puede ni enseñar, y una sin puntos no rebaja nada.
      .filter((b) => texto(b.etiqueta) && leido(b.puntos) !== undefined)
      .map((b) => ({
        id: idDeBonificacion(b.etiqueta as string),
        etiqueta: b.etiqueta as string,
        descuentoPuntos: leido(b.puntos),
        criterio: texto(b.criterio),
      })),
  };
}

/** Lee una FEIN y devuelve el borrador · lanza si el servicio falla. */
export async function leerFeinConClaude(archivo: File | Blob): Promise<FeinLoanDraft> {
  const nombre = archivo instanceof File ? archivo.name : 'FEIN';
  // `Blob` ya trae `type`; no hace falta fingir que es un `File`.
  const respuesta = await callScanChat(archivo, archivo.type || 'application/pdf', 'scan_fein');

  const leida = respuesta.extraido;
  if (!leida || typeof leida !== 'object') {
    throw new Error('El servicio no devolvió las condiciones de la FEIN');
  }
  return draftDesdeLeida(leida as FeinLeida, nombre);
}
