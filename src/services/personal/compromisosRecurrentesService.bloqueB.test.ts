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

describe('compromisosRecurrentesService · el patrón NO tiene tope de 24 meses', () => {
  it('expande a demanda hasta el horizonte que pida el llamante (20 años · criterio §6)', () => {
    const desde = new Date();
    // 20 años vista · 240 meses.
    const hasta = new Date(desde.getFullYear() + 20, desde.getMonth(), 28);
    const eventos = generarEventosDesdeCompromiso(compromiso(), hasta);

    // Mensual → ~240 cargos. Muy por encima de 24: el límite ha desaparecido.
    expect(eventos.length).toBeGreaterThan(200);
    const añoMax = Math.max(...eventos.map((e) => e.año));
    expect(añoMax).toBeGreaterThanOrEqual(desde.getFullYear() + 19);
  });

  it('sin horizonte explícito materializa una ventana por defecto acotada (no 20 años)', () => {
    const eventos = generarEventosDesdeCompromiso(compromiso());
    // El default es una ventana corta (rolling ~24m), no un horizonte infinito.
    expect(eventos.length).toBeLessThan(40);
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

  // La capa viva arranca en el mes en curso, no en `fechaInicio`: un
  // compromiso de 2019 no reconstruye siete años de recibos cada vez que se
  // regenera. Lo que sí entra del mes en curso —su cargo, aunque el día ya
  // haya pasado— tiene su propio bloque más abajo.
  it('la capa viva (sin override) no reconstruye el pasado', () => {
    // fechaInicio 2019 pero sin desdeOverride: nada de 2019/2020 debe aparecer.
    const eventos = generarEventosDesdeCompromiso(compromiso());
    expect(eventos.some((e) => e.año <= 2020)).toBe(false);
  });
});

// ============================================================================
// El cargo del MES EN CURSO que ya ha pasado
// ============================================================================
//
// La proyección arrancaba en HOY, apoyada en que "los eventos pasados ya están
// confirmados por extracto bancario". Eso no se sostiene para un gasto que
// acabas de dar de alta: un recibo con cargo el día 1, creado el día 3, no
// generaba NADA en el mes en curso. Su cargo real se quedaba sin previsión con
// la que casar, y el mes decía que ibas según lo previsto mientras el dinero ya
// había salido de la cuenta.

describe('el cargo de este mes no se pierde por haber llegado tarde', () => {
  const elDia = (dia: number): CompromisoRecurrente =>
    ({
      ...compromiso(),
      patron: { tipo: 'mensualDiaFijo', dia },
      fechaInicio: '2019-01-01',
    }) as unknown as CompromisoRecurrente;

  const primeroDeEsteMes = (): string => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  };

  it('un cargo del día 1 se genera aunque hoy sea después', () => {
    const eventos = generarEventosDesdeCompromiso(elDia(1));
    const fechas = eventos.map((e) => e.predictedDate.slice(0, 10));

    expect(fechas).toContain(primeroDeEsteMes());
  });

  // El primer día del mes es el mismo borde que usa el bootstrap al purgar
  // previsiones viejas: emitir antes sería emitir algo que él va a borrar.
  it('no se emite nada anterior al mes en curso', () => {
    const eventos = generarEventosDesdeCompromiso(elDia(1));
    const anteriores = eventos.filter(
      (e) => e.predictedDate.slice(0, 10) < primeroDeEsteMes()
    );

    expect(anteriores).toEqual([]);
  });

  // Un compromiso que todavía no ha empezado no adelanta su primer cargo al
  // mes en curso sólo porque la ventana arranque ahí.
  it('lo que empieza en el futuro sigue empezando en el futuro', () => {
    const dentroDeUnAño = new Date();
    dentroDeUnAño.setFullYear(dentroDeUnAño.getFullYear() + 1);
    const inicio = dentroDeUnAño.toISOString().slice(0, 10);
    const futuro = {
      ...compromiso(),
      fechaInicio: inicio,
    } as unknown as CompromisoRecurrente;

    const eventos = generarEventosDesdeCompromiso(futuro);

    expect(eventos.every((e) => e.predictedDate.slice(0, 10) >= inicio)).toBe(true);
  });
});
