// Los seguros que prueban una bonificación · §6 ter.
//
// «Los seguros tienen que domiciliarse, ya sea agrario o medio pensionista»
// *(Jose · 6 ago 2026)*. La prueba está en tesorería, no en un módulo de
// pólizas que no existe.
//
// Y lo que este fichero vigila sobre todo es que **lo previsto cuente**. Es la
// diferencia de fondo con la nómina: una nómina puede venir por menos o no
// venir, y por eso allí solo cuenta lo cobrado. Un compromiso recurrente activo
// es un contrato dado de alta, con su cuenta y su calendario, que ATLAS ya está
// proyectando. Esperar a diciembre para decir que se cumple sería que ATLAS
// desconfiara de su propio dato.

import { segurosDomiciliados, deLaCuenta, delTipo, primaTotal } from '../segurosDomiciliados';
import { verificarBonificaciones } from '../verificarBonificaciones';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Bonificacion, ReglaBonificacion } from '../../../types/prestamos';

const poliza = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    ambito: 'personal',
    alias: 'Seguro de hogar',
    tipo: 'seguro',
    subtipo: 'hogar',
    proveedor: { nombre: 'Mapfre' },
    patron: { tipo: 'mensualDiaFijo', dia: 5 },
    importe: { modo: 'fijo', importe: 25 },
    cuentaCargo: 1,
    conceptoBancario: 'MAPFRE',
    metodoPago: 'domiciliacion',
    estado: 'activo',
    ...over,
  }) as unknown as CompromisoRecurrente;

const bonif = (regla: ReglaBonificacion, over: Partial<Bonificacion> = {}): Bonificacion =>
  ({
    id: 'b1',
    tipo: 'SEGURO_HOGAR',
    nombre: 'Bloque Seguro Hogar',
    reduccionPuntosPorcentuales: 0.2,
    impacto: { puntos: 0.2 },
    estado: 'SELECCIONADO',
    cuentaExigidaId: '1',
    lookbackMeses: 12,
    regla,
    ...over,
  }) as unknown as Bonificacion;

const pruebas = (compromisos: CompromisoRecurrente[]) => ({
  tarjetas: [],
  periodosDeTarjeta: [],
  cobrosDeNomina: [],
  recibosDomiciliados: [],
  segurosDomiciliados: segurosDomiciliados(compromisos, 2026),
});

describe('la prima se proyecta, no se espera a que llegue', () => {
  it('25 € al mes son 300 € al año desde el primer día', () => {
    const [s] = segurosDomiciliados([poliza()], 2026);

    expect(s.primaAnual).toBe(300);
    expect(s.subtipo).toBe('hogar');
  });

  it('una anual de golpe también son sus 300 €', () => {
    const [s] = segurosDomiciliados(
      [
        poliza({
          patron: { tipo: 'anualMesesConcretos', mesesPago: [3], diaPago: 10 },
          importe: { modo: 'fijo', importe: 300 },
        } as Partial<CompromisoRecurrente>),
      ],
      2026
    );

    expect(s.primaAnual).toBe(300);
  });

  // `preparado` es «existe en el plan y nunca ha tenido un cargo», y `baja` es
  // «se cobraba y dejó de llegar». Ninguno de los dos prueba nada hoy.
  it('una póliza que no está activa no cuenta', () => {
    expect(segurosDomiciliados([poliza({ estado: 'preparado' })], 2026)).toHaveLength(0);
    expect(segurosDomiciliados([poliza({ estado: 'baja' })], 2026)).toHaveLength(0);
  });

  // Un pago único no es un compromiso recurrente · meterlo diría que el año que
  // viene vuelve a pasar.
  it('y un pago puntual tampoco', () => {
    expect(
      segurosDomiciliados(
        [poliza({ patron: { tipo: 'puntual', fecha: '2026-03-01', importe: 300 } } as Partial<CompromisoRecurrente>)],
        2026
      )
    ).toHaveLength(0);
  });

  // Se reconoce por `tipo === 'seguro'`, que es un campo del modelo · no por
  // que el concepto contenga la palabra. Esta decisión dice si una bonificación
  // se gana o se pierde, así que no puede salir de una heurística.
  it('un recibo que no es un seguro no es un seguro aunque se llame así', () => {
    expect(
      segurosDomiciliados([poliza({ tipo: 'suministro', alias: 'Seguro de luz' })], 2026)
    ).toHaveLength(0);
  });
});

describe('las de fuera no bonifican', () => {
  // Lo que el banco premia es que le pases el recibo a él · pagarla por
  // transferencia o con tarjeta no es domiciliarla, y con tarjeta la cuenta que
  // consta es la de liquidación, que puede ser de otro banco entero.
  it('una póliza que no está domiciliada no cuenta', () => {
    expect(segurosDomiciliados([poliza({ metodoPago: 'transferencia' })], 2026)).toHaveLength(0);
    expect(segurosDomiciliados([poliza({ metodoPago: 'tarjeta' })], 2026)).toHaveLength(0);
  });

  it('una póliza cargada en otro banco no cuenta para este', () => {
    const todas = segurosDomiciliados([poliza({ cuentaCargo: 9 })], 2026);

    expect(todas).toHaveLength(1);
    expect(deLaCuenta(todas, 1)).toHaveLength(0);
  });
});

describe('de qué es cada póliza', () => {
  const dos = () =>
    segurosDomiciliados([poliza(), poliza({ alias: 'Vida riesgo', subtipo: 'vida' })], 2026);

  it('se distinguen por su subtipo', () => {
    expect(delTipo(dos(), 'hogar')).toHaveLength(1);
    expect(delTipo(dos(), 'vida')).toHaveLength(1);
  });

  // Dar por buena una póliza cualquiera convertiría «tengo el seguro de vida»
  // en «tengo algún seguro», que no es la condición del contrato.
  it('y una que no dice de qué es no vale por ninguna', () => {
    const anonima = segurosDomiciliados(
      [poliza({ alias: 'Póliza 4471', subtipo: undefined })],
      2026
    );

    expect(anonima).toHaveLength(1);
    expect(delTipo(anonima, 'hogar')).toHaveLength(0);
  });

  it('las primas se suman', () => {
    expect(primaTotal(dos())).toBe(600);
  });
});

// ── Contra la verificación ──────────────────────────────────────────────────
//
// Aquí ponía «un seguro se prueba con su póliza, no con un movimiento», y por
// eso toda condición de seguro salía como no verificable. Era falso: un seguro
// se domicilia.
describe('las tres formas que usan los bancos', () => {
  const hoy = '2026-06-30';

  it('¿la tienes? · con la póliza domiciliada, cumple', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_HOGAR', activo: true })],
      pruebas([poliza()]),
      hoy
    );

    expect(c.veredicto).toBe('cumple');
  });

  it('y sin ella, NO cumple · que no es lo mismo que no poder mirarlo', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_HOGAR', activo: true })],
      pruebas([]),
      hoy
    );

    expect(c.veredicto).toBe('no_cumple');
    expect(c.motivo).toContain('hogar');
  });

  it('¿cuántas? · dos pólizas cualesquiera', () => {
    const dos = [poliza(), poliza({ alias: 'Salud', subtipo: 'salud' })];
    const regla: ReglaBonificacion = { tipo: 'SEGUROS', minimoPolizas: 2 };

    expect(verificarBonificaciones([bonif(regla)], pruebas(dos), hoy)[0].veredicto).toBe('cumple');
    expect(
      verificarBonificaciones([bonif(regla)], pruebas([poliza()]), hoy)[0].veredicto
    ).toBe('no_cumple');
  });

  it('¿por cuánto? · contra la prima proyectada del año', () => {
    const regla: ReglaBonificacion = { tipo: 'SEGUROS', primaAnualMinima: 500 };
    const dos = [poliza(), poliza({ alias: 'Vida', subtipo: 'vida' })];

    // 300 + 300 = 600 · llega. Una sola, 300, no.
    expect(verificarBonificaciones([bonif(regla)], pruebas(dos), hoy)[0].medido).toBe(600);
    expect(verificarBonificaciones([bonif(regla)], pruebas(dos), hoy)[0].veredicto).toBe('cumple');
    expect(
      verificarBonificaciones([bonif(regla)], pruebas([poliza()]), hoy)[0].veredicto
    ).toBe('no_cumple');
  });

  // Tesorería prueba que la póliza existe · no por cuánto cubre. Un «cumple»
  // aquí sería un falso positivo: hay vidas por el 50 % del capital que no dan
  // la bonificación, y el recibo cuesta lo mismo.
  it('el % del capital de una vida no se ve en el recibo · y se dice', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_VIDA', activo: true, capitalAseguradoPct: 100 })],
      pruebas([poliza({ alias: 'Vida riesgo', subtipo: 'vida' })]),
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
    expect(c.motivo).toContain('hay seguro de vida domiciliado');
    expect(c.motivo).toContain('100 %');
  });

  // Sin cifra pedida, «tener el seguro de vida» sí se comprueba entero.
  it('pero sin cifra, tener la póliza es toda la condición', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_VIDA', activo: true })],
      pruebas([poliza({ alias: 'Vida riesgo', subtipo: 'vida' })]),
      hoy
    );

    expect(c.veredicto).toBe('cumple');
  });

  // Negarse a responder por prudencia es un modo de fallo, no un valor por
  // defecto: la tercera respuesta está para lo que de verdad no se sabe.
  it('con pólizas sin identificar, la tercera respuesta · no un no', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_VIDA', activo: true })],
      pruebas([poliza({ alias: 'Póliza 4471', subtipo: undefined })]),
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
    expect(c.motivo).toContain('ninguna dice ser de vida');
  });

  it('y sin decir en qué cuenta, tampoco se puede mirar', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_HOGAR', activo: true }, { cuentaExigidaId: undefined })],
      pruebas([poliza()]),
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
    expect(c.motivo).toContain('cuenta');
  });

  // Sin gastos recurrentes dados de alta no hay dónde mirar · distinto de no
  // tener la póliza.
  it('sin compromisos cargados no se acusa de incumplir', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'SEGURO_HOGAR', activo: true })],
      { tarjetas: [], periodosDeTarjeta: [], cobrosDeNomina: [], recibosDomiciliados: [] },
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
  });
});
