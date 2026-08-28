// ============================================================================
// T4 · cada estado ofrece lo suyo, y solo lo suyo
// ============================================================================
//
// Lo que vigila: que «Eliminar» ya no exista sobre una previsión (su función es
// descartar), que deshacer una confirmación se ofrezca SOLO donde la dijo el
// usuario, y que lo conciliado por el banco lleve candado y ninguna acción —a
// propósito, no por olvido—.
import {
  accionesDeFila,
  etiquetaDeBaja,
  laBajaEsDescarte,
  sePuedeDeshacer,
} from '../accionesDePrevision';
import type { ItemPunteo } from '../punteoModel';

const it_ = (over: Partial<ItemPunteo> = {}): ItemPunteo => ({
  key: 'evt-1', kind: 'evento', refId: 1, estado: 'previsto',
  fecha: '2026-09-03', concepto: 'Netflix', activo: null, origen: 'Suscripción',
  cuentaId: 1, importe: -13.99, editable: true, ...over,
});

describe('previsto · las cuatro acciones', () => {
  it('confirmar, editar, ir al gasto y descartar', () => {
    expect(accionesDeFila(it_({ gastoRecurrente: '/personal/gastos?gasto=7' })))
      .toEqual(['confirmar', 'editar', 'irAlGasto', 'descartar']);
  });

  it('una previsión suelta no ofrece ir al gasto · no hay ficha que abrir', () => {
    expect(accionesDeFila(it_())).toEqual(['confirmar', 'editar', 'descartar']);
  });

  // La razón de ser de T4 · «Eliminar» sobre una previsión nunca borró.
  it('nunca ofrece «eliminar» · sobre una previsión eso era descartar', () => {
    expect(accionesDeFila(it_())).not.toContain('eliminar');
  });
});

describe('confirmado a mano · se deshace', () => {
  const punteado = (over: Partial<ItemPunteo> = {}) =>
    it_({ kind: 'movimiento', estado: 'confirmado', previsionId: 55, ...over });

  it('deshacer y editar', () => {
    expect(accionesDeFila(punteado())).toEqual(['deshacer', 'editar']);
  });

  it('un movimiento anotado a mano NO se deshace · no nació de ninguna previsión', () => {
    expect(sePuedeDeshacer(punteado({ previsionId: undefined }))).toBe(false);
    expect(accionesDeFila(punteado({ previsionId: undefined }))).toEqual(['editar']);
  });

  it('un evento `confirmed` sin punteo detrás tampoco · nunca se punteó', () => {
    // La venta de un piso, la liquidación de un préstamo: decididos, esperando
    // al banco.
    expect(sePuedeDeshacer(it_({ estado: 'confirmado' }))).toBe(false);
  });
});

describe('conciliado por el banco · candado, y nada más', () => {
  const delBanco = it_({ kind: 'movimiento', estado: 'conciliado', previsionId: 55, editable: false });

  it('solo el candado', () => {
    expect(accionesDeFila(delBanco)).toEqual(['candado']);
  });

  it('no se deshace · la jerarquía es conciliado > confirmado > previsto', () => {
    expect(sePuedeDeshacer(delBanco)).toBe(false);
    expect(accionesDeFila(delBanco)).not.toContain('deshacer');
  });

  it('ni siquiera trayendo una previsión detrás · el banco no se discute', () => {
    expect(accionesDeFila(it_({ kind: 'movimiento', estado: 'conciliado', previsionId: 99, editable: true })))
      .toEqual(['candado']);
  });
});

describe('descartada · recuperable', () => {
  it('lo único que ofrece es recuperar', () => {
    expect(accionesDeFila(it_({ descartado: true }))).toEqual(['recuperar']);
  });

  it('y manda sobre el estado · una descartada no se confirma', () => {
    expect(accionesDeFila(it_({ descartado: true, gastoRecurrente: '/x' })))
      .not.toContain('confirmar');
  });
});

describe('el pie de la ficha dice lo que el botón hace', () => {
  it('sobre una previsión, descarta', () => {
    expect(laBajaEsDescarte(it_())).toBe(true);
    expect(etiquetaDeBaja(it_())).toBe('Descartar');
  });

  it('sobre un movimiento anotado a mano, borra de verdad', () => {
    expect(etiquetaDeBaja(it_({ kind: 'movimiento' }))).toBe('Eliminar');
  });

  it('y sobre un traspaso también · borra las dos patas', () => {
    expect(etiquetaDeBaja(it_({ traspaso: { eventId: 1, origenId: 1, destinoId: 2 } })))
      .toBe('Eliminar');
  });
});
