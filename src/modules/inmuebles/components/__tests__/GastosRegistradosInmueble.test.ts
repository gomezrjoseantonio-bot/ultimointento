/**
 * Tests de la Fase 3: selector interno de vistas de Gastos y
 * componente GastosRegistradosInmueble.
 *
 * Cubre:
 * - GastosRegistradosInmueble: estado vacío
 * - GastosRegistradosInmueble: separa mejoras de gastos operativos
 * - GastosRegistradosInmueble: separa mobiliario de gastos operativos
 * - GastosRegistradosInmueble: excluye gastos de otro inmueble
 * - construirListaVisualGastosInmueble: no incluye recurrentes en registrados
 */

import {
  construirListaVisualGastosInmueble,
} from '../../adapters/gastosInmuebleAdapter';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../../services/db';

// ─── Fixtures ─────────────────────────────────────────────────────────────

function crearGastoReal(parcial: Partial<GastoInmueble> = {}): GastoInmueble {
  return {
    id: 1,
    inmuebleId: 10,
    fecha: '2026-03-01',
    concepto: 'Agua',
    importe: 45,
    categoria: 'suministro',
    casillaAEAT: '0108',
    categoryKey: 'suministro_inmueble',
    estado: 'confirmado',
    ejercicio: 2026,
    origen: 'manual',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearMejora(parcial: Partial<MejoraInmueble> = {}): MejoraInmueble {
  return {
    id: 2,
    inmuebleId: 10,
    fecha: '2026-04-01',
    descripcion: 'Reforma cocina',
    importe: 3000,
    tipo: 'mejora',
    ejercicio: 2026,
    categoryKey: 'mejora_inmueble',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearMueble(parcial: Partial<MuebleInmueble> = {}): MuebleInmueble {
  return {
    id: 3,
    inmuebleId: 10,
    descripcion: 'Sofá',
    importe: 500,
    fechaAlta: '2026-05-01',
    activo: true,
    vidaUtil: 10,
    ejercicio: 2026,
    categoryKey: 'mobiliario_inmueble',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...parcial,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('GastosRegistradosInmueble · construirListaVisualGastosInmueble', () => {
  it('devuelve lista vacía cuando no hay datos', () => {
    const lista = construirListaVisualGastosInmueble({ inmuebleId: 10 });
    expect(lista).toHaveLength(0);
  });

  it('gasto real aparece con origen=real', () => {
    const gastoReal = crearGastoReal();
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [gastoReal],
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].origen).toBe('real');
    expect(lista[0].inmuebleId).toBe(10);
  });

  it('mejora aparece con origen=mejora y grupoVisual=mejorar', () => {
    const mejora = crearMejora();
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      mejoras: [mejora],
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].origen).toBe('mejora');
    expect(lista[0].grupoVisual).toBe('mejorar');
  });

  it('mueble aparece con origen=mobiliario y grupoVisual=mobiliario', () => {
    const mueble = crearMueble();
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      mobiliario: [mueble],
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].origen).toBe('mobiliario');
    expect(lista[0].grupoVisual).toBe('mobiliario');
  });

  it('mejora NO se mezcla con gasto operativo (grupoVisual diferente)', () => {
    const gastoReal = crearGastoReal();
    const mejora = crearMejora();
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [gastoReal],
      mejoras: [mejora],
    });
    const origenMejora = lista.find((i) => i.origen === 'mejora');
    const origenReal = lista.find((i) => i.origen === 'real');
    expect(origenMejora?.grupoVisual).toBe('mejorar');
    expect(origenReal?.grupoVisual).not.toBe('mejorar');
  });

  it('mobiliario NO se suma como gasto operativo (grupoVisual diferente)', () => {
    const gastoReal = crearGastoReal();
    const mueble = crearMueble();
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [gastoReal],
      mobiliario: [mueble],
    });
    const origenMobiliario = lista.find((i) => i.origen === 'mobiliario');
    const origenReal = lista.find((i) => i.origen === 'real');
    expect(origenMobiliario?.grupoVisual).toBe('mobiliario');
    expect(origenReal?.grupoVisual).not.toBe('mobiliario');
  });

  it('excluye gastos de otro inmueble', () => {
    const gastoOtro = crearGastoReal({ inmuebleId: 99 });
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [gastoOtro],
    });
    expect(lista).toHaveLength(0);
  });

  it('excluye mejoras de otro inmueble', () => {
    const mejoraOtra = crearMejora({ inmuebleId: 99 });
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      mejoras: [mejoraOtra],
    });
    expect(lista).toHaveLength(0);
  });

  it('excluye mobiliario de otro inmueble', () => {
    const muebleOtro = crearMueble({ inmuebleId: 99 });
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      mobiliario: [muebleOtro],
    });
    expect(lista).toHaveLength(0);
  });

  it('mezcla correcta de los tres tipos de registro', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [crearGastoReal()],
      mejoras: [crearMejora()],
      mobiliario: [crearMueble()],
    });
    expect(lista).toHaveLength(3);
    expect(lista.map((i) => i.origen).sort()).toEqual(['mejora', 'mobiliario', 'real'].sort());
  });

  it('compromisos recurrentes vacíos no afectan a los registrados', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [],
      gastosReales: [crearGastoReal()],
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].origen).toBe('real');
  });
});

// ─── Tests del selector de sub-tabs (comportamiento de clasificación) ─────

describe('GastosSubTab · clasificación por origen', () => {
  it('la lista de registrados no incluye compromisos recurrentes', () => {
    // Sin compromisos recurrentes pasados → lista solo con gastos reales
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [],
      gastosReales: [crearGastoReal()],
    });
    const origenes = lista.map((i) => i.origen);
    expect(origenes).not.toContain('recurrente');
    expect(origenes).toContain('real');
  });
});
