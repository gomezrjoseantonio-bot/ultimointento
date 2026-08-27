// ============================================================================
// Cerrar la línea de gasto al conciliar · el arreglo de la regresión de #1809
// ============================================================================
//
// Puntear una previsión a mano cerraba su línea de `gastosInmueble` —estado,
// estadoTesoreria y movimientoId— pero conciliar el mismo evento subiendo el
// extracto del banco no la tocaba. Los dos dejaban bien el evento y el
// movimiento; la línea fiscal solo la cerraba uno.
//
// Daba igual hasta que #1809 hizo que la declaración mirara justo esos tres
// campos para decidir qué deduce: desde entonces, quien concilia con el fichero
// del banco perdía gastos que sí había pagado.
// ============================================================================

import {
  origenIdRecurrenteDeEvento,
  camposDeCierre,
  aceptaCierre,
} from '../cierreLineaInmueble';
import type { GastoInmueble, TreasuryEvent } from '../db';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 7,
    sourceType: 'gasto_recurrente',
    sourceId: 42,
    año: 2026,
    mes: 3,
    ambito: 'INMUEBLE',
    inmuebleId: 1,
    status: 'predicted',
    ...over,
  }) as TreasuryEvent;

const linea = (over: Partial<GastoInmueble> = {}): GastoInmueble =>
  ({
    id: 5,
    inmuebleId: 1,
    ejercicio: 2026,
    fecha: '2026-03-15',
    concepto: 'Comunidad',
    categoria: 'comunidad',
    casillaAEAT: '0109',
    importe: 60,
    origen: 'recurrente',
    origenId: 'recurrente-42-2026-3',
    estado: 'previsto',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as GastoInmueble;

// ─── el enlace ──────────────────────────────────────────────────────────────

describe('origenIdRecurrenteDeEvento · el puente entre las dos claves', () => {
  // La línea de un recurrente NO lleva `treasuryEventId`: nace de
  // `generarOperacionesDesdeRecurrentes` con `origenId`. La misma clave se
  // puede reconstruir desde el evento, que guarda el compromiso y el mes.
  it('reconstruye el origenId del gasto desde el evento', () => {
    expect(origenIdRecurrenteDeEvento(evento())).toBe('recurrente-42-2026-3');
  });

  it('el mes va sin cero a la izquierda · como lo escribe el generador', () => {
    expect(origenIdRecurrenteDeEvento(evento({ mes: 12 }))).toBe('recurrente-42-2026-12');
    expect(origenIdRecurrenteDeEvento(evento({ mes: 1 }))).toBe('recurrente-42-2026-1');
  });

  it('un evento que no viene de un gasto recurrente no tiene esa clave', () => {
    expect(origenIdRecurrenteDeEvento(evento({ sourceType: 'contrato' as never }))).toBeNull();
    expect(origenIdRecurrenteDeEvento(evento({ sourceId: undefined }))).toBeNull();
    expect(origenIdRecurrenteDeEvento(evento({ año: undefined }))).toBeNull();
    expect(origenIdRecurrenteDeEvento(evento({ mes: undefined }))).toBeNull();
  });
});

// ─── qué se escribe ─────────────────────────────────────────────────────────

describe('camposDeCierre · lo mismo que escribe el punteo manual', () => {
  it('los tres campos que mira la declaración, más el enlace al evento', () => {
    expect(camposDeCierre(31, 7)).toEqual({
      estado: 'confirmado',
      estadoTesoreria: 'confirmed',
      movimientoId: '31',
      treasuryEventId: 7,
    });
  });

  it('el movimiento va como cadena · es como lo guarda `confirmTreasuryEvent`', () => {
    expect(camposDeCierre(31, 7).movimientoId).toBe('31');
  });
});

// ─── a qué líneas se aplica ─────────────────────────────────────────────────

describe('aceptaCierre · a qué línea se le puede', () => {
  it('a una previsión, sí · es justo la que hay que cerrar', () => {
    expect(aceptaCierre(linea({ estado: 'previsto' }))).toBe(true);
  });

  it('a una ya confirmada, también · es idempotente', () => {
    expect(aceptaCierre(linea({ estado: 'confirmado' }))).toBe(true);
  });

  // Un ejercicio declarado es verdad consumida. Pasar su línea a `confirmado`
  // sería degradar el dato que se presentó a Hacienda, y el resumen fiscal de
  // ese año sale del snapshot AEAT congelado, no de aquí.
  it('a una DECLARADA, no · no se reescribe lo que ya se presentó', () => {
    expect(aceptaCierre(linea({ estado: 'declarado' }))).toBe(false);
  });

  it('sin línea no hay nada que cerrar', () => {
    expect(aceptaCierre(undefined)).toBe(false);
    expect(aceptaCierre(null)).toBe(false);
  });
});
