// V81 · TAREA CC · Bloque B.3 + B.4 — pruebas de aceptación:
//  B.3: se puede pedir la previsión de un mes YA PASADO (proyección hacia atrás).
//  B.4: el evento generado LLEVA su bolsa 50/30/20.
import {
  generarEventosDesdeCompromiso,
  generarEventosHistoricos,
} from './compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const compromiso = (): CompromisoRecurrente =>
  ({
    id: 'c1',
    ambito: 'personal',
    alias: 'Gimnasio',
    tipo: 'suscripcion',
    proveedor: { nombre: 'GymCo' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 40 },
    cuentaCargo: 0,
    conceptoBancario: 'GYMCO',
    metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones' as never,
    bolsaPresupuesto: 'deseos',
    responsable: 'titular',
    fechaInicio: '2019-01-01',
    estado: 'activo',
    createdAt: '2019-01-01',
    updatedAt: '2019-01-01',
  }) as unknown as CompromisoRecurrente;

describe('compromisosRecurrentesService · Bloque B.4 · la bolsa viaja al evento', () => {
  it('cada evento generado lleva la bolsaPresupuesto del compromiso', () => {
    const eventos = generarEventosDesdeCompromiso(compromiso());
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.bolsaPresupuesto === 'deseos')).toBe(true);
  });
});

describe('compromisosRecurrentesService · Bloque B.3 · proyección hacia atrás', () => {
  it('generarEventosHistoricos devuelve eventos de un rango YA PASADO', () => {
    const desde = new Date('2020-01-01');
    const hasta = new Date('2020-03-31');
    const eventos = generarEventosHistoricos(compromiso(), desde, hasta);

    // día 1 de ene/feb/mar 2020 → al menos 3 eventos, todos en el pasado.
    expect(eventos.length).toBeGreaterThanOrEqual(3);
    expect(eventos.every((e) => e.año === 2020)).toBe(true);
    expect(eventos.map((e) => e.mes).sort()).toEqual([1, 2, 3]);
    // y siguen llevando su bolsa.
    expect(eventos.every((e) => e.bolsaPresupuesto === 'deseos')).toBe(true);
  });

  it('la capa viva (sin override) sigue proyectando SOLO desde hoy — no genera pasado', () => {
    // fechaInicio 2019 pero sin desdeOverride: nada de 2019/2020 debe aparecer.
    const eventos = generarEventosDesdeCompromiso(compromiso());
    expect(eventos.some((e) => e.año <= 2020)).toBe(false);
  });
});
