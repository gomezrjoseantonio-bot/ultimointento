// Qué demuestran los movimientos de cada bonificación · VOCABULARIO §6 ter y §3.6.
//
// Aquí se decide una cifra que se presume ante un banco. Lo que vigilan estos
// tests es que no se dé por probado nada que no lo esté: ni una tarjeta de
// fuera, ni un periodo que todavía puede crecer, ni una condición que nadie
// sabe mirar.

import { verificarBonificaciones } from '../verificarBonificaciones';
import type { SeguroDomiciliado } from '../segurosDomiciliados';
import type { MovimientosQuePrueban } from '../verificarBonificaciones';
import type { GastoDeUnPeriodo } from '../../gastoPorTarjeta';
import type { CobroDeUnMes } from '../cobrosDeNomina';
import type { RecibosDeUnMes } from '../recibosDomiciliados';
import type { Bonificacion } from '../../../types/prestamos';
import type { Tarjeta } from '../../../types/tarjetas';

const HOY = '2026-08-03';

const tarjeta = (over: Partial<Tarjeta> = {}): Tarjeta =>
  ({
    id: 7,
    alias: 'Unicaja Oro',
    origen: 'banco',
    modalidad: 'credito',
    cuentaLiquidacionId: 2,
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta;

const periodo = (over: Partial<GastoDeUnPeriodo> = {}): GastoDeUnPeriodo => ({
  tarjetaId: 7,
  fechaCorte: '2026-05-24',
  fechaCargo: '2026-06-05',
  importe: 1000,
  estado: 'cerrado',
  ...over,
});

const bonif = (over: Partial<Bonificacion> = {}): Bonificacion => ({
  id: 'b1',
  tipo: 'TARJETA',
  nombre: 'Uso tarjeta',
  reduccionPuntosPorcentuales: 0.001,
  impacto: { puntos: -0.1 },
  lookbackMeses: 6,
  regla: { tipo: 'TARJETA', importeMinimo: 3000 },
  estado: 'SELECCIONADO',
  tarjetaExigidaId: 7,
  ...over,
});

const con = (
  tarjetas: Tarjeta[],
  periodos: GastoDeUnPeriodo[],
  nomina: CobroDeUnMes[] = [],
  recibos: RecibosDeUnMes[] = []
): MovimientosQuePrueban => ({
  tarjetas,
  periodosDeTarjeta: periodos,
  cobrosDeNomina: nomina,
  recibosDomiciliados: recibos,
});

const unaSola = (b: Bonificacion, m: MovimientosQuePrueban, hasta = HOY) =>
  verificarBonificaciones([b], m, hasta)[0];

describe('la condición de tarjeta', () => {
  it('cumple cuando el gasto cerrado llega al mínimo', () => {
    const r = unaSola(
      bonif(),
      con([tarjeta()], [periodo({ importe: 2000 }), periodo({ fechaCorte: '2026-06-24', importe: 1200 })])
    );

    expect(r).toMatchObject({ veredicto: 'cumple', medido: 3200, exigido: 3000 });
  });

  it('no cumple cuando se queda corto', () => {
    const r = unaSola(bonif(), con([tarjeta()], [periodo({ importe: 2000 })]));

    expect(r).toMatchObject({ veredicto: 'no_cumple', medido: 2000 });
  });

  it('dice en qué tramo ha mirado', () => {
    expect(unaSola(bonif(), con([tarjeta()], [])).ventana).toEqual({
      desde: '2026-02-04',
      hasta: HOY,
    });
  });

  // §3.5 · «una bonificación se demuestra con lo cobrado, no con lo que esperas
  // gastar». El periodo abierto todavía puede crecer o quedarse corto.
  it('el periodo abierto no demuestra nada', () => {
    const r = unaSola(
      bonif(),
      con(
        [tarjeta()],
        [periodo({ importe: 2000 }), periodo({ fechaCorte: '2026-07-24', importe: 1500, estado: 'abierto' })]
      )
    );

    expect(r.veredicto).toBe('no_cumple');
    expect(r.medido).toBe(2000);
  });

  // Pero tampoco se esconde: el gasto ya está hecho y solo falta que lo cobren.
  // Sin esto parecería que faltan 1.000 € por gastar cuando ya se gastaron.
  it('lo que aún no se ha cobrado se dice aparte', () => {
    const r = unaSola(
      bonif(),
      con(
        [tarjeta()],
        [periodo({ importe: 2000 }), periodo({ fechaCorte: '2026-07-24', importe: 1500, estado: 'abierto' })]
      )
    );

    expect(r.sinCobrar).toBe(1500);
  });

  // El gasto de hace un año no prueba la ventana de este semestre.
  it('lo de fuera de la ventana no cuenta', () => {
    const r = unaSola(
      bonif(),
      con([tarjeta()], [periodo({ importe: 5000, fechaCorte: '2025-11-24' })])
    );

    expect(r).toMatchObject({ veredicto: 'no_cumple', medido: 0 });
  });

  // §3.6 · importa LA TARJETA CONCRETA, no la cuenta: de una misma cuenta
  // cuelgan dos y el banco bonifica por una.
  it('solo cuenta la tarjeta exigida, no sus hermanas', () => {
    const otra = tarjeta({ id: 8, alias: 'Unicaja Débito' });
    const r = unaSola(
      bonif(),
      con([tarjeta(), otra], [periodo({ importe: 2000 }), periodo({ tarjetaId: 8, importe: 4000 })])
    );

    expect(r).toMatchObject({ veredicto: 'no_cumple', medido: 2000 });
  });
});

describe('lo que no puede demostrarse', () => {
  // §3.6 · «Las de fuera nunca bonifican: son externas justamente por eso».
  // Y esto NO es un "no se puede comprobar": la respuesta es que no, y decirlo
  // de otra forma mandaría a gastar más para arreglar lo que no se arregla
  // gastando.
  it('una tarjeta de fuera no cumple, por mucho que se gaste', () => {
    const r = unaSola(
      bonif(),
      con([tarjeta({ origen: 'externa', alias: 'Carrefour' })], [periodo({ importe: 9000 })])
    );

    expect(r.veredicto).toBe('no_cumple');
    expect(r.motivo).toContain('las de fuera nunca bonifican');
  });

  it('sin decir qué tarjeta no se puede mirar', () => {
    const r = unaSola(bonif({ tarjetaExigidaId: undefined }), con([tarjeta()], [periodo()]));

    expect(r).toMatchObject({ veredicto: 'no_verificable' });
    expect(r.motivo).toContain('con qué tarjeta');
  });

  it('si la tarjeta ya no está se dice, no se da por incumplida', () => {
    expect(unaSola(bonif(), con([], [periodo()])).veredicto).toBe('no_verificable');
  });

  // Del crédito se conoce el recibo del periodo —la suma—, no las compras una
  // a una (§3.5). "6 operaciones al mes" no se puede contar hoy.
  it('contar operaciones no se puede con lo que hay', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'TARJETA', movimientosMesMin: 6 } }),
      con([tarjeta()], [periodo()])
    );

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('operaciones');
  });

  it('una regla sin importe no dice cuánto', () => {
    const r = unaSola(bonif({ regla: { tipo: 'TARJETA' } }), con([tarjeta()], [periodo()]));

    expect(r.veredicto).toBe('no_verificable');
  });

  // §6 ter · «seguros contratados… todos son condiciones que se verifican
  // contra la tesorería». Las que aún no tienen fuente se dicen una a una; no
  // se dan por buenas ni por perdidas.
  it('las condiciones sin fuente se nombran una a una', () => {
    const seguro = unaSola(
      bonif({ regla: { tipo: 'SEGURO_HOGAR', activo: true } }),
      con([tarjeta()], [])
    );
    const plan = unaSola(
      bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true } }),
      con([tarjeta()], [])
    );

    expect(seguro.veredicto).toBe('no_verificable');
    expect(seguro.motivo).toContain('póliza');
    expect(plan.motivo).toContain('plan');
  });
});

// §6 ter · la segunda fuente. Lo que el banco mira es lo que le entra a él: la
// nómina domiciliada en SU cuenta, por encima del mínimo, mes tras mes.
describe('la condición de nómina', () => {
  const mes = (m: string, importe: number, cuentaId = 3): CobroDeUnMes => ({
    cuentaId,
    mes: m,
    importe,
    estado: 'cerrado',
  });

  const deNomina = (over: Partial<Bonificacion> = {}): Bonificacion =>
    bonif({
      tipo: 'NOMINA',
      nombre: 'Nómina',
      regla: { tipo: 'NOMINA', minimoMensual: 1200 },
      tarjetaExigidaId: undefined,
      cuentaExigidaId: '3',
      ...over,
    });

  const seisMeses = [
    mes('2026-03', 1300),
    mes('2026-04', 1300),
    mes('2026-05', 1300),
    mes('2026-06', 1300),
    mes('2026-07', 1300),
    mes('2026-08', 1300),
  ];

  it('cumple cuando todos los meses llegan', () => {
    const r = unaSola(deNomina(), con([], [], seisMeses));

    expect(r).toMatchObject({
      veredicto: 'cumple',
      exigido: 1200,
      mensual: { conMovimiento: 6, queLlegan: 6 },
    });
  });

  // «1.200 € al mes» no lo cumple un semestre con 7.800 € si un mes vino corto.
  // Basta uno por debajo para perderla, así que decide el mes más flojo.
  it('un solo mes corto la tumba, aunque el total sobre', () => {
    const conUnoCorto = [...seisMeses.slice(1), mes('2026-03', 900)];
    const r = unaSola(deNomina(), con([], [], conUnoCorto));

    expect(r).toMatchObject({
      veredicto: 'no_cumple',
      medido: 900,
      mensual: { conMovimiento: 6, queLlegan: 5 },
    });
  });

  // Domiciliada en otro banco · eso SÍ es incumplir, y se sabe.
  it('la nómina en otra cuenta no cumple, y se dice por qué', () => {
    const r = unaSola(deNomina(), con([], [], [mes('2026-05', 2000, 9)]));

    expect(r.veredicto).toBe('no_cumple');
    expect(r.motivo).toContain('ninguna nómina en esa cuenta');
  });

  // Distinto de lo anterior: aquí ATLAS no sabe de ninguna nómina, y el
  // silencio no es un «no».
  it('sin ninguna nómina dada de alta no se puede comprobar', () => {
    const r = unaSola(deNomina(), con([], [], []));

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('ninguna nómina dada de alta');
  });

  it('sin decir la cuenta no se puede mirar', () => {
    const r = unaSola(deNomina({ cuentaExigidaId: undefined }), con([], [], seisMeses));

    expect(r).toMatchObject({ veredicto: 'no_verificable' });
    expect(r.motivo).toContain('en qué cuenta');
  });

  // El selector deja `''` al no elegir · `Number('')` es 0, un id que parece
  // válido, y se habría mirado la cuenta cero.
  it('una cuenta sin elegir no es la cuenta cero', () => {
    const r = unaSola(deNomina({ cuentaExigidaId: '' }), con([], [], seisMeses));

    expect(r.veredicto).toBe('no_verificable');
  });

  it('sin decir cuánto tampoco', () => {
    const r = unaSola(
      deNomina({ regla: { tipo: 'NOMINA', minimoMensual: 0 } }),
      con([], [], seisMeses)
    );

    expect(r.motivo).toContain('cuánto tiene que entrar');
  });

  // §3.5 · se demuestra con lo cobrado. Lo que aún no ha entrado no prueba nada.
  it('un mes todavía abierto no cuenta', () => {
    const conAbierto: CobroDeUnMes[] = [
      ...seisMeses,
      { cuentaId: 3, mes: '2026-09', importe: 200, estado: 'abierto' },
    ];

    expect(unaSola(deNomina(), con([], [], conAbierto))).toMatchObject({
      veredicto: 'cumple',
      mensual: { conMovimiento: 6, queLlegan: 6 },
    });
  });

  it('lo de fuera de la ventana no cuenta', () => {
    const r = unaSola(deNomina(), con([], [], [mes('2024-05', 900), ...seisMeses]));

    expect(r).toMatchObject({ veredicto: 'cumple', mensual: { conMovimiento: 6 } });
  });
});

describe('cuáles se miran', () => {
  // Enseñar "no cumples" de algo que nunca se contrató es ruido, y el ruido
  // acaba tapando la que sí importa.
  it('la que el usuario no contrató queda fuera', () => {
    const activa = bonif();
    const inactiva = bonif({ id: 'b2', estado: 'INACTIVO' });

    const ids = verificarBonificaciones([activa, inactiva], con([tarjeta()], []), HOY).map(
      (c) => c.bonificacionId
    );

    expect(ids).toEqual(['b1']);
  });

  it('un préstamo sin bonificaciones no revienta', () => {
    expect(verificarBonificaciones(undefined, con([], []), HOY)).toEqual([]);
  });
});

// Lo guardado no siempre tiene la forma que dice el tipo: hay préstamos
// anteriores a que `regla` y `lookbackMeses` existieran. El asistente los
// rellena al abrirlos, pero la ficha del préstamo lee de la base directamente,
// así que aquí llegan crudos. Sin esto no dan un resultado raro: rompen la
// pantalla entera.
describe('bonificaciones viejas, guardadas a medias', () => {
  const cruda = (falta: Partial<Bonificacion>) =>
    unaSola({ ...bonif(), ...falta } as Bonificacion, con([tarjeta()], [periodo()]));

  it('sin regla no revienta · dice que no sabe qué demostrar', () => {
    const r = cruda({ regla: undefined as unknown as Bonificacion['regla'] });

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('qué hay que demostrar');
  });

  // Un `NaN` aquí no daba una fecha rara: `toISOString()` LANZA, y se lleva por
  // delante la ficha del préstamo.
  it('con una ventana que no es número no revienta', () => {
    const r = cruda({ lookbackMeses: NaN });

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('cuántos meses');
  });

  // Y no se le inventa una ventana por defecto: medir seis meses lo que se
  // pactó a doce diría «no cumples» de algo que sí se cumple.
  it('sin ventana no se inventa una', () => {
    expect(cruda({ lookbackMeses: undefined as unknown as number }).veredicto).toBe(
      'no_verificable'
    );
    expect(cruda({ lookbackMeses: 0 }).veredicto).toBe('no_verificable');
  });

  // Leerían «No se puede comprobar · undefined», que no dice nada.
  it('un tipo de regla que ya no existe se explica igual', () => {
    const r = cruda({ regla: { tipo: 'DOMICILIACION_ANTIGUA' } as unknown as Bonificacion['regla'] });

    expect(r).toMatchObject({ veredicto: 'no_verificable', motivo: 'no se reconoce qué mirar' });
  });
});

// §6 ter · la tercera fuente, y la última que sale de los movimientos. Lo que
// queda —seguros, alarma— se prueba con papel, no con un cargo.
describe('la condición de recibos domiciliados', () => {
  const mes = (m: string, cuantos: number, cuentaId = 3): RecibosDeUnMes => ({
    cuentaId,
    mes: m,
    cuantos,
    estado: 'cerrado',
  });

  const deRecibos = (over: Partial<Bonificacion> = {}): Bonificacion =>
    bonif({
      tipo: 'RECIBOS',
      nombre: 'Recibos',
      regla: { tipo: 'RECIBOS', minimoRecibos: 3 },
      tarjetaExigidaId: undefined,
      cuentaExigidaId: '3',
      ...over,
    });

  const seisMeses = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m) =>
    mes(m, 4)
  );

  it('cumple cuando todos los meses llegan al mínimo', () => {
    expect(unaSola(deRecibos(), con([], [], [], seisMeses))).toMatchObject({
      veredicto: 'cumple',
      exigido: 3,
      unidad: 'recibos',
      mensual: { conMovimiento: 6, queLlegan: 6 },
    });
  });

  // Basta un mes flojo para que la revisión la tumbe · decide el peor.
  it('un mes con menos recibos la tumba', () => {
    const conUnoCorto = [...seisMeses.slice(1), mes('2026-03', 2)];

    expect(unaSola(deRecibos(), con([], [], [], conUnoCorto))).toMatchObject({
      veredicto: 'no_cumple',
      medido: 2,
      mensual: { conMovimiento: 6, queLlegan: 5 },
    });
  });

  // A diferencia de la nómina, aquí el silencio SÍ es un «no»: no hace falta
  // dar de alta nada para que ATLAS vea un recibo domiciliado.
  it('sin recibos en esa cuenta no cumple, no es una duda', () => {
    const r = unaSola(deRecibos(), con([], [], [], [mes('2026-05', 5, 9)]));

    expect(r).toMatchObject({ veredicto: 'no_cumple', medido: 0 });
    expect(r.motivo).toContain('ningún recibo en esa cuenta');
  });

  it('sin decir la cuenta no se puede mirar', () => {
    const r = unaSola(deRecibos({ cuentaExigidaId: '' }), con([], [], [], seisMeses));

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('en qué cuenta');
  });

  it('sin decir cuántos tampoco', () => {
    const r = unaSola(
      deRecibos({ regla: { tipo: 'RECIBOS', minimoRecibos: 0 } }),
      con([], [], [], seisMeses)
    );

    expect(r.motivo).toContain('cuántos recibos');
  });
});

// Los recibos se CUENTAN · «2,5 recibos» no existe. El asistente ya guarda
// enteros; esto protege del dato guardado a mano, que si no acabaría dicho tal
// cual en pantalla.
describe('un umbral de recibos con decimales', () => {
  const mes = (m: string, cuantos: number): RecibosDeUnMes => ({
    cuentaId: 3,
    mes: m,
    cuantos,
    estado: 'cerrado',
  });

  const conUmbral = (minimoRecibos: number, cuantos: number) =>
    verificarBonificaciones(
      [
        bonif({
          tipo: 'RECIBOS',
          regla: { tipo: 'RECIBOS', minimoRecibos },
          tarjetaExigidaId: undefined,
          cuentaExigidaId: '3',
        }),
      ],
      con([], [], [], [mes('2026-05', cuantos)]),
      HOY
    )[0];

  // Al menos 2,5 recibos se cumple con TRES, no con dos · `ceil`, no `round`.
  it('se redondea hacia arriba · es un mínimo', () => {
    expect(conUmbral(2.5, 3)).toMatchObject({ veredicto: 'cumple', exigido: 3 });
    expect(conUmbral(2.5, 2)).toMatchObject({ veredicto: 'no_cumple', exigido: 3 });
  });

  it('un entero no se mueve', () => {
    expect(conUmbral(3, 3).exigido).toBe(3);
  });
});

// Un mes que TODAVÍA NO CUENTA no es un mes SIN NÓMINA. Confundirlos es la
// misma tercera respuesta de §6 ter, y aquí sale caro: acusa de incumplir a
// quien solo tiene el cobro por constar.
describe('lo que todavía no consta cobrado', () => {
  const mesNomina = (m: string, importe: number, estado: 'cerrado' | 'abierto'): CobroDeUnMes => ({
    cuentaId: 3,
    mes: m,
    importe,
    estado,
  });

  const deNomina = (over: Partial<Bonificacion> = {}): Bonificacion =>
    bonif({
      tipo: 'NOMINA',
      regla: { tipo: 'NOMINA', minimoMensual: 1200 },
      tarjetaExigidaId: undefined,
      cuentaExigidaId: '3',
      ...over,
    });

  // Antes esto decía «no cumple · no ha entrado ninguna nómina», que es falso:
  // la nómina SÍ está domiciliada ahí. Y el motivo no afirma POR QUÉ no consta
  // —conciliar o no haber pasado aún son dos cosas y desde aquí no se saben—.
  it('con nada cerrado todavía no se acusa de incumplir', () => {
    const r = unaSola(
      deNomina(),
      con([], [], [mesNomina('2026-05', 1300, 'abierto'), mesNomina('2026-06', 1300, 'abierto')])
    );

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('no consta cobrada');
  });

  // Callarlos dejaba «2 de 2 meses» donde faltaban dos por mirar · una
  // tranquilidad prestada.
  it('los meses que aún no cuentan van aparte', () => {
    const r = unaSola(
      deNomina(),
      con(
        [],
        [],
        [
          mesNomina('2026-05', 1300, 'cerrado'),
          mesNomina('2026-06', 1300, 'cerrado'),
          mesNomina('2026-07', 1300, 'abierto'),
        ]
      )
    );

    expect(r).toMatchObject({
      veredicto: 'cumple',
      mensual: { conMovimiento: 2, queLlegan: 2, sinCerrar: 1 },
    });
  });

  // Sin nada, ni previsto ni cobrado, sigue siendo un «no».
  it('sin nada en esa cuenta sigue siendo no cumple', () => {
    const r = unaSola(deNomina(), con([], [], [mesNomina('2026-05', 1300, 'cerrado')].map((m) => ({ ...m, cuentaId: 9 }))));

    expect(r.veredicto).toBe('no_cumple');
  });

  it('lo mismo vale para los recibos', () => {
    const deRecibos = bonif({
      tipo: 'RECIBOS',
      regla: { tipo: 'RECIBOS', minimoRecibos: 3 },
      tarjetaExigidaId: undefined,
      cuentaExigidaId: '3',
    });
    const abierto: RecibosDeUnMes = { cuentaId: 3, mes: '2026-05', cuantos: 4, estado: 'abierto' };

    expect(unaSola(deRecibos, con([], [], [], [abierto])).veredicto).toBe('no_verificable');
  });
});


// Cerrar el mes convierte «todavía no consta» en un NO · §6 quater.
//
// Sin el cierre, un mes sin la nómina se queda siempre en «no cuenta todavía» y
// la bonificación no se puede perder nunca. Al cerrar, ese mes entra con lo que
// de verdad entró — cero si no entró nada— y el mes más flojo decide.
describe('con el mes cerrado', () => {
  const nomina = (mes: string, importe: number, estado: 'cerrado' | 'abierto') =>
    ({ cuentaId: 1, mes, importe, estado }) as never;

  const bonif = {
    id: 'n',
    tipo: 'NOMINA',
    nombre: 'Nómina',
    reduccionPuntosPorcentuales: 0.3,
    impacto: { puntos: -0.3 },
    lookbackMeses: 6,
    cuentaExigidaId: '1',
    regla: { tipo: 'NOMINA', minimoMensual: 1200 },
    estado: 'SELECCIONADO',
  } as never;

  const conMeses = (mesesCerrados: string[]) =>
    verificarBonificaciones(
      [bonif],
      {
        tarjetas: [],
        periodosDeTarjeta: [],
        recibosDomiciliados: [],
        cobrosDeNomina: [
          nomina('2026-06', 1300, 'cerrado'),
          nomina('2026-07', 0, 'abierto'),
        ],
        mesesCerrados,
      } as never,
      '2026-08-05'
    )[0];

  it('sin cerrar, el mes vacío no cuenta y no se pierde nada', () => {
    const c = conMeses([]);

    expect(c.veredicto).toBe('cumple');
    expect(c.mensual?.sinCerrar).toBe(1);
  });

  it('cerrado, el mes vacío cuenta como cero y la bonificación se pierde', () => {
    const c = conMeses(['2026-07']);

    expect(c.veredicto).toBe('no_cumple');
    expect(c.mensual?.sinCerrar).toBe(0);
    expect(c.mensual?.conMovimiento).toBe(2);
  });
});

// ── La madre del cordero · las dos ramas de la condición de ingresos ────────
//
// «Ojo con las nóminas... algunos bancos les valen ingresos recurrentes»
// *(Jose · 6 ago 2026)*. La FEIN de Unicaja: «Nómina, o Pensión, o Prestación
// económica de la Seguridad Social, por importe igual o superior a 2.500,00
// euros netos mensuales; o ingresos recurrentes por importe anual igual o
// superior a 30.000 euros netos».
//
// Son DOS condiciones y basta con una. Mirando solo la nómina, quien cumple
// por alquileres salía como que no cumple y se le decía que perdía medio punto
// que no pierde.
describe('ingresos recurrentes · la rama que no exige nómina', () => {
  const conIngresos = (importeMensual: number, meses: number) =>
    Array.from({ length: meses }, (_, i) => ({
      cuentaId: 1,
      mes: `2026-${String(i + 1).padStart(2, '0')}`,
      importe: importeMensual,
      estado: 'cerrado' as const,
    }));

  const bonif = (minimoAnualRecurrente?: number) =>
    ({
      id: 'b1',
      tipo: 'NOMINA' as const,
      nombre: 'Bloque Haberes',
      reduccionPuntosPorcentuales: 0.5,
      impacto: { puntos: 0.5 },
      estado: 'SELECCIONADO' as const,
      cuentaExigidaId: '1',
      lookbackMeses: 12,
      regla: { tipo: 'NOMINA' as const, minimoMensual: 2500, minimoAnualRecurrente },
    });

  const pruebas = (ingresosRecurrentes: any[]) => ({
    tarjetas: [],
    periodosDeTarjeta: [],
    // NINGUNA nómina · quien cobra de sus pisos no tiene ninguna.
    cobrosDeNomina: [],
    recibosDomiciliados: [],
    ingresosRecurrentes,
  });

  it('cumple quien cobra 3.000 al mes de alquileres, sin una sola nómina', () => {
    const [c] = verificarBonificaciones(
      [bonif(30000)],
      pruebas(conIngresos(3000, 12)),
      '2026-12-31'
    );

    expect(c.veredicto).toBe('cumple');
    expect(c.medido).toBe(36000);
  });

  // Sin esa rama en el contrato, la nómina manda y sigue sin poder mirarse.
  it('pero solo si el contrato la ofrece', () => {
    const [c] = verificarBonificaciones(
      [bonif(undefined)],
      pruebas(conIngresos(3000, 12)),
      '2026-12-31'
    );

    expect(c.veredicto).toBe('no_verificable');
  });

  // Fallar por esta rama no es fallar: la disyunción sigue viva por la otra.
  it('y quedarse corto por aquí no decide nada · manda la nómina', () => {
    const [c] = verificarBonificaciones(
      [bonif(30000)],
      pruebas(conIngresos(500, 12)),
      '2026-12-31'
    );

    expect(c.veredicto).toBe('no_verificable');
    expect(c.motivo).toContain('nómina');
  });

  // Lo previsto no cuenta, y un mes cerrado A MANO cuenta con CERO: cerrarlo es
  // decir que lo que quedaba abierto no llegó a entrar (§6 quater). Es la misma
  // regla que aplica la nómina, y ahora la aplican las dos leyendo el mismo
  // sitio — escrita dos veces, bastaba tocar una para que contaran distinto.
  it('un mes abierto no suma aunque el mes esté cerrado a mano', () => {
    const once = conIngresos(3000, 11);
    const conUnoAbierto = [
      ...once,
      { cuentaId: 1, mes: '2026-12', importe: 3000, estado: 'abierto' as const },
    ];

    const [sinCerrarElMes] = verificarBonificaciones(
      [bonif(30000)],
      pruebas(conUnoAbierto),
      '2026-12-31'
    );
    const [cerrandoloAMano] = verificarBonificaciones(
      [bonif(30000)],
      { ...pruebas(conUnoAbierto), mesesCerrados: ['2026-12'] },
      '2026-12-31'
    );

    // 33.000 € de los once meses cobrados · el doceavo no entró.
    expect(sinCerrarElMes.medido).toBe(33000);
    expect(cerrandoloAMano.medido).toBe(33000);
  });

  // El motivo decía «N meses cobrados», y entre esos N puede haber alguno
  // cerrado a mano en el que no entró nada. Afirmar que se cobró un mes vacío
  // es afirmar un hecho que no ocurrió.
  it('y el motivo no llama «cobrado» a un mes en el que no entró nada', () => {
    const [c] = verificarBonificaciones(
      [bonif(30000)],
      pruebas(conIngresos(3000, 12)),
      '2026-12-31'
    );

    expect(c.motivo).toContain('ingresos recurrentes');
    expect(c.motivo).not.toContain('cobrados');
  });
});

// ── La cuenta que nadie rellenaba ───────────────────────────────────────────
//
// Un seguro domiciliado en la cuenta correcta salía «sin comprobar · no dice en
// qué cuenta hay que domiciliar la póliza», teniendo ATLAS la cuenta del
// préstamo delante *(Jose · 8 ago 2026)*. El banco bonifica por lo que le entra
// a ÉL, y la cuenta por la que te cobra la hipoteca es suya.
describe('la cuenta del préstamo hace de respaldo', () => {
  const poliza = (cuentaId: number): SeguroDomiciliado => ({
    cuentaId,
    alias: 'Seguro hogar',
    subtipo: 'hogar',
    primaAnual: 483.48,
  });

  it('sin cuenta en la bonificación, se mira la del préstamo', () => {
    const r = unaSola(bonif({ regla: { tipo: 'SEGURO_HOGAR', activo: true }, cuentaExigidaId: undefined }), {
      ...con([tarjeta()], []),
      segurosDomiciliados: [poliza(3)],
      cuentaDelPrestamo: 3,
    });

    expect(r.veredicto).toBe('cumple');
  });

  // Y sigue mandando la de la bonificación cuando está: hay anexos que exigen
  // una cuenta distinta de la del recibo, y eso el préstamo no lo sabe.
  it('pero la que exige la bonificación manda sobre ella', () => {
    const r = unaSola(bonif({ regla: { tipo: 'SEGURO_HOGAR', activo: true }, cuentaExigidaId: '9' }), {
      ...con([tarjeta()], []),
      segurosDomiciliados: [poliza(3)],
      cuentaDelPrestamo: 3,
    });

    expect(r.veredicto).not.toBe('cumple');
  });

  it('y sin ninguna de las dos, sigue diciendo qué falta', () => {
    const r = unaSola(bonif({ regla: { tipo: 'SEGURO_HOGAR', activo: true }, cuentaExigidaId: undefined }), {
      ...con([tarjeta()], []),
      segurosDomiciliados: [poliza(3)],
    });

    expect(r.veredicto).toBe('no_verificable');
    expect(r.motivo).toContain('cuenta');
  });
});

// ── Planes y fondos · la prueba estaba en tesorería ─────────────────────────
//
// «Son MOVIMIENTOS DE TESORERÍA de esa cuenta a la aportación del plan de ese
// banco» *(Jose · 8 ago 2026)*. FONDOS estaba en la lista de lo que no se sabe
// mirar, y los planes se comprobaban contra un store aparte que, vacío, no
// decía «no lo sé» sino «no cumples» — un falso negativo.
describe('lo que sale de la cuenta hacia un plan o un fondo', () => {
  const aportado = (salido: number, cuentaId = 3, previsto = 0) => [
    {
      cuentaId,
      anio: 2026,
      importe: salido + previsto,
      salido,
      estado: (previsto > 0 ? 'abierto' : 'cerrado') as 'abierto' | 'cerrado',
    },
  ];
  const hasta = '2026-08-31';

  it('un fondo con su aportación se cumple · ya no es «sin comprobar»', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', aportacionAnual: 3000 } }),
      { ...con([tarjeta()], []), aportacionesDeTesoreria: aportado(3000), cuentaDelPrestamo: 3 },
      hasta
    );

    expect(r.veredicto).toBe('cumple');
    expect(r.medido).toBe(3000);
  });

  it('y por debajo del mínimo, no', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', aportacionAnual: 3000 } }),
      { ...con([tarjeta()], []), aportacionesDeTesoreria: aportado(1000), cuentaDelPrestamo: 3 },
      hasta
    );

    expect(r.veredicto).toBe('no_cumple');
  });

  it('un plan sin cifra se cumple con que le entre algo', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true } }),
      { ...con([tarjeta()], []), aportacionesDeTesoreria: aportado(600), cuentaDelPrestamo: 3 },
      hasta
    );

    expect(r.veredicto).toBe('cumple');
  });

  // Lo que sale de OTRA cuenta no le entra a este banco · igual que la tarjeta
  // de fuera no cuenta.
  it('lo aportado desde otra cuenta no le entra a este banco', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true } }),
      { ...con([tarjeta()], []), aportacionesDeTesoreria: aportado(600, 9), cuentaDelPrestamo: 3 },
      hasta
    );

    expect(r.veredicto).toBe('no_cumple');
  });

  // Sin movimientos que mirar no se afirma nada · «no lo sé» y «no cumples» son
  // respuestas distintas, y confundirlas fue el falso negativo del plan.
  it('sin movimientos donde mirar, no se dice que no', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', aportacionAnual: 3000 } }),
      con([tarjeta()], [])
    );

    expect(r.veredicto).toBe('no_verificable');
  });

  // Una transferencia al plan la haces cuando quieres · una prevista no
  // demuestra nada, y darla por hecha regalaría la bonificación en enero.
  describe('lo previsto no cuenta como aportado', () => {
    it('una aportación que aún no ha salido no cumple', () => {
      const r = unaSola(
        bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 1500 } }),
        {
          ...con([tarjeta()], []),
          aportacionesDeTesoreria: aportado(0, 3, 1500),
          cuentaDelPrestamo: 3,
        },
        hasta
      );

      expect(r.veredicto).toBe('no_cumple');
      expect(r.medido).toBe(0);
      // Y se dice lo que falta por salir · «todavía no» no es «nunca».
      expect(r.sinCobrar).toBe(1500);
    });

    it('y sin cifra pedida tampoco se da por tenido · es un todavía no', () => {
      const r = unaSola(
        bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true } }),
        {
          ...con([tarjeta()], []),
          aportacionesDeTesoreria: aportado(0, 3, 600),
          cuentaDelPrestamo: 3,
        },
        hasta
      );

      expect(r.veredicto).toBe('no_verificable');
      expect(r.motivo).toContain('todavía no ha salido');
    });
  });
});

// ── La otra rama · «habrá otros que será TENER X en el fondo» ───────────────
//
// *«Es aportación en este caso, pero habrá otros que será tener X en el fondo o
// en el plan de pensiones del banco — por eso era clave la modelación de las
// bonificaciones»* *(Jose · 9 ago 2026)*. Son dos preguntas distintas y se
// prueban en sitios distintos: lo aportado en tesorería, lo que tienes en la
// posición. Medir una con la otra da un veredicto sobre dinero equivocado.
describe('lo que TIENES en el producto del banco', () => {
  const hasta = '2026-08-31';
  const conSaldo = (valor: number, familia: 'fondo' | 'plan' = 'fondo', entidad = 'unicaja') => ({
    ...con([tarjeta()], []),
    entidad: 'Unicaja Banco, S.A.',
    saldoEnElBanco: [{ entidad, familia, valor }],
    cuentaDelPrestamo: 3,
  });

  it('30.000 € en el fondo cumplen la condición de saldo', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', saldoMinimo: 30000 } }),
      conSaldo(30000),
      hasta
    );

    expect(r.veredicto).toBe('cumple');
    expect(r.medido).toBe(30000);
  });

  it('y por debajo, no', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', saldoMinimo: 30000 } }),
      conSaldo(12000),
      hasta
    );

    expect(r.veredicto).toBe('no_cumple');
  });

  // Un fondo no vale por un plan · el anexo dice cuál de los dos.
  it('el saldo de un fondo no cumple una condición de plan', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'PLAN_PENSIONES', activo: true, saldoMinimo: 10000 } }),
      conSaldo(30000, 'fondo'),
      hasta
    );

    expect(r.veredicto).toBe('no_verificable');
  });

  // El anexo pide un producto SUYO · el fondo del banco de al lado no bonifica,
  // igual que la tarjeta de fuera no cuenta.
  it('el fondo de otra entidad no bonifica en este préstamo', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', saldoMinimo: 30000 } }),
      conSaldo(30000, 'fondo', 'santander'),
      hasta
    );

    expect(r.veredicto).toBe('no_verificable');
  });

  // Basta con una · la misma disyunción que la nómina, que admite «X al mes o Y
  // al año». Con las dos ramas escritas, no aportar este año no tumba a quien
  // lleva el saldo que le piden dentro.
  it('con el saldo puesto no hace falta haber aportado', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', saldoMinimo: 30000, aportacionAnual: 3000 } }),
      { ...conSaldo(30000), aportacionesDeTesoreria: [] },
      hasta
    );

    expect(r.veredicto).toBe('cumple');
  });

  // Y al revés · quien acaba de aportar lo que le piden cumple aunque el
  // mercado haya dejado la posición por debajo.
  it('y aportando lo pedido se cumple aunque el saldo no llegue', () => {
    const r = unaSola(
      bonif({ regla: { tipo: 'FONDOS', saldoMinimo: 30000, aportacionAnual: 3000 } }),
      {
        ...conSaldo(2800),
        aportacionesDeTesoreria: [
          { cuentaId: 3, anio: 2026, importe: 3000, salido: 3000, estado: 'cerrado' as const },
        ],
      },
      hasta
    );

    expect(r.veredicto).toBe('cumple');
    expect(r.medido).toBe(3000);
  });
});
