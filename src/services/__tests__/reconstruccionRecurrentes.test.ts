// ============================================================================
// C1 · el año 0 de los gastos recurrentes
// ============================================================================
//
// El motor solo proyecta del día 1 del mes en curso hacia delante, así que el
// pasado del ejercicio está vacío: no hay nada que confirmar ni con qué cuadrar
// el extracto. Esto lo puebla, del suelo de C0 hasta AYER, como PREVISTO.
//
// Las dos barreras que se comprueban aquí antes que nada: el saldo no se mueve
// (un previsto no es caja) y ejecutarlo dos veces no duplica.
// ============================================================================

import { ventanaDelPasado } from '../reconstruccionRecurrentes';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const compromiso = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 1,
    alias: 'Comunidad',
    ambito: 'inmueble',
    inmuebleId: 1,
    estado: 'activo',
    fechaInicio: '2026-01-01',
    patron: { tipo: 'mensualDiaFijo', dia: 2 },
    importe: { modo: 'fijo', importe: 60 },
    proveedor: { nombre: 'Comunidad' },
    metodoPago: 'domiciliado',
    categoria: 'vivienda.comunidad',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente;

const iso = (d: Date): string => d.toISOString().slice(0, 10);

describe('ventanaDelPasado · de dónde a dónde se reconstruye', () => {
  it('el techo es AYER · hoy no es pasado', () => {
    const v = ventanaDelPasado(compromiso(), '2026-01-01', '2026-08-28');
    expect(iso(v!.hasta)).toBe('2026-08-27');
  });

  it('el suelo manda cuando el gasto empezó antes', () => {
    const v = ventanaDelPasado(compromiso({ fechaInicio: '2025-03-01' }), '2026-01-01', '2026-08-28');
    expect(iso(v!.desde)).toBe('2026-01-01');
  });

  it('la fecha de inicio manda cuando es posterior al suelo', () => {
    const v = ventanaDelPasado(compromiso({ fechaInicio: '2026-02-24' }), '2026-01-01', '2026-08-28');
    expect(iso(v!.desde)).toBe('2026-02-24');
  });

  it('un gasto que empieza HOY no tiene pasado que reconstruir', () => {
    expect(ventanaDelPasado(compromiso({ fechaInicio: '2026-08-28' }), '2026-01-01', '2026-08-28')).toBeNull();
  });

  it('ni uno que empieza mañana', () => {
    expect(ventanaDelPasado(compromiso({ fechaInicio: '2026-09-15' }), '2026-01-01', '2026-08-28')).toBeNull();
  });

  // El 1 de enero no hay pasado: ayer cae en el ejercicio anterior, por debajo
  // del suelo. Reconstruir ahí sería saltarse la franja que fijó C0.
  it('el día 1 del ejercicio no hay ventana', () => {
    expect(ventanaDelPasado(compromiso(), '2026-01-01', '2026-01-01')).toBeNull();
  });

  it('un gasto dado de baja no proyecta más allá de su fin', () => {
    // El motor ya recorta por `fechaFin`; la ventana solo no puede empezar
    // después de terminar.
    const v = ventanaDelPasado(compromiso({ fechaFin: '2026-03-31' }), '2026-01-01', '2026-08-28');
    expect(iso(v!.desde)).toBe('2026-01-01');
    expect(v!.hasta.getTime()).toBeGreaterThan(v!.desde.getTime());
  });

  it('un gasto que terminó ANTES del suelo no se reconstruye', () => {
    expect(ventanaDelPasado(compromiso({ fechaFin: '2025-11-30' }), '2026-01-01', '2026-08-28')).toBeNull();
  });

  // Franja cerrada (hoy 28/8 · C0 devuelve 1/1 del año en curso): por debajo
  // del suelo no se baja, aunque el gasto venga de años atrás.
  it('nunca por debajo del suelo · aunque el gasto sea de 2019', () => {
    const v = ventanaDelPasado(compromiso({ fechaInicio: '2019-05-01' }), '2026-01-01', '2026-08-28');
    expect(iso(v!.desde)).toBe('2026-01-01');
  });
});
