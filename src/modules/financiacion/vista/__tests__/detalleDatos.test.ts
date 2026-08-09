// Lo que el detalle deriva del préstamo · Entregable B.
//
// Lo que vigilan estos casos es la ADAPTACIÓN POR TIPO, que es lo que separa
// las dos fichas del mockup: un mixto tiene que enseñar sus dos tramos y su
// teórico tachado, y un fijo simple uno solo que ocupa la barra entera. Y que
// el «no deducible» venga siempre con su motivo: sin él, la tarjeta repite un
// «no» que el usuario ya sabe.

import { generarCuadro } from '../../../../services/prestamos/cuadro';
import {
  getInteresPendiente,
  getPreviewCuadro,
  getPrincipalInicial,
  getProgresoCuotas,
} from '../../../../services/prestamos/lecturas';
import {
  condicionesDe,
  cuandoSePierde,
  fiscalidadDe,
  hayDiscrepancia,
  lineaDeTiempo,
  resumenBonificaciones,
  type BonificacionDetalle,
} from '../detalleDatos';
import type { Cumplimiento } from '../../../../services/bonificaciones/cumplimiento';
import type { Revision } from '../../../../services/bonificaciones/revisionDelBanco';
import type { Bonificacion, Prestamo } from '../../../../types/prestamos';

/** Un día del TRAMO FIJO de la Unicaja · los 36 meses acaban el 25/08/2026. */
const HOY = '2026-08-09';

const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    nombre: 'Hipoteca Unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

const personal = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'personal',
    nombre: 'Sabadell 24.500',
    principalInicial: 24500,
    plazoMesesTotal: 96,
    fechaFirma: '2025-01-15',
    fechaPrimerCargo: '2025-02-15',
    diaCargoMes: 15,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4.49,
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

const bonificacion = (over: Partial<Bonificacion> = {}): Bonificacion =>
  ({
    id: 'b1',
    tipo: 'NOMINA',
    nombre: 'Ingresos domiciliados',
    reduccionPuntosPorcentuales: 0.5,
    impacto: { puntos: -0.5 },
    lookbackMeses: 6,
    regla: { tipo: 'NOMINA', minimoMensual: 2400 },
    estado: 'CUMPLIDA',
    ...over,
  }) as unknown as Bonificacion;

describe('lineaDeTiempo · la ficha se adapta al tipo de préstamo', () => {
  it('un fijo simple tiene UN tramo que ocupa la barra entera', () => {
    const p = personal();
    const t = lineaDeTiempo(p, generarCuadro(p), '2026-03-01');

    expect(t.tramos).toHaveLength(1);
    expect(t.tramos[0].anchoPct).toBeCloseTo(100, 0);
    expect(t.tramos[0].tramo.variable).toBe(false);
  });

  it('un mixto parte la barra en tramo fijo y tramo variable', () => {
    const p = unicaja();
    const t = lineaDeTiempo(p, generarCuadro(p), '2026-03-01');

    expect(t.tramos).toHaveLength(2);
    expect(t.tramos[0].tramo.variable).toBe(false);
    expect(t.tramos[1].tramo.variable).toBe(true);
    // 36 meses fijos de 240 · el teaser es un 15 % del préstamo.
    expect(t.tramos[0].anchoPct).toBeCloseTo(15, 0);
    expect(t.tramos[0].anchoPct + t.tramos[1].anchoPct).toBeCloseTo(100, 0);
  });

  it('cada tramo trae su cuota y su tipo, y el variable sube', () => {
    const p = unicaja();
    const t = lineaDeTiempo(p, generarCuadro(p), '2026-03-01');

    expect(t.tramos[0].tin).toBeCloseTo(2.6, 3);
    expect(t.tramos[1].tin).toBeCloseTo(3.85, 3);
    expect(t.tramos[1].cuota).toBeGreaterThan(t.tramos[0].cuota);
  });

  it('el marcador de hoy cae dentro de la barra durante la vida del préstamo', () => {
    const p = unicaja();

    expect(lineaDeTiempo(p, generarCuadro(p), '2026-03-01').hoyPct).toBeGreaterThan(0);
    expect(lineaDeTiempo(p, generarCuadro(p), '2026-03-01').hoyPct).toBeLessThan(100);
    // Antes de firmar no hay nada que marcar.
    expect(lineaDeTiempo(p, generarCuadro(p), '2020-01-01').hoyPct).toBeNull();
  });
});

describe('resumenBonificaciones · el teórico y el bonificado', () => {
  it('sin bonificaciones no hay lista · su tarjeta se omite', () => {
    expect(resumenBonificaciones(personal(), HOY).lista).toHaveLength(0);
  });

  it('lista TODAS · las que faltan también, que son las que puedes ir a buscar', () => {
    const p = unicaja({
      bonificaciones: [
        bonificacion(),
        bonificacion({ id: 'b2', nombre: 'Seguro de hogar', estado: 'PERDIDA' }),
      ],
    });
    const r = resumenBonificaciones(p, HOY);

    expect(r.lista).toHaveLength(2);
    expect(r.lista[0].alcanzada).toBe(true);
    expect(r.lista[1].alcanzada).toBe(false);
  });

  it('solo suman las alcanzadas', () => {
    const p = unicaja({
      bonificaciones: [
        bonificacion({ reduccionPuntosPorcentuales: 0.5 }),
        bonificacion({ id: 'b2', reduccionPuntosPorcentuales: 0.3, estado: 'PERDIDA' }),
      ],
    });

    expect(resumenBonificaciones(p, HOY).rebajaTotal).toBeCloseTo(0.5, 3);
  });

  it('el tope del anexo capa la suma · no se rebaja más de lo pactado', () => {
    const p = unicaja({
      topeBonificacionesTotal: -1,
      bonificaciones: [
        bonificacion({ reduccionPuntosPorcentuales: 0.8 }),
        bonificacion({ id: 'b2', reduccionPuntosPorcentuales: 0.7 }),
      ],
    });
    const r = resumenBonificaciones(p, HOY);

    expect(r.tope).toBeCloseTo(1, 3);
    expect(r.rebajaTotal).toBeCloseTo(1, 3);
  });
});

// ── Sobre QUÉ tipo rebajan ──────────────────────────────────────────────────
//
// La tarjeta decía «tu tipo de hoy 3,60 → 2,60 %» en la mixta de Jose, y es
// falso por los dos lados: ni paga el 3,60 ni las bonificaciones le están
// bajando nada. Su escritura bonifica «en el SEGUNDO y en los sucesivos
// periodos de interés», así que durante los 36 meses fijos da igual el anexo
// entero — lo que se juega ahí se cobra el 25/08/2026.
describe('resumenBonificaciones · sobre qué tramo rebajan', () => {
  const conAnexo = (over: Partial<Prestamo> = {}) =>
    unicaja({
      bonificaciones: [bonificacion({ reduccionPuntosPorcentuales: 1 })],
      ...over,
    });

  it('en el tramo fijo de una mixta que solo bonifica el variable, hoy no rebajan', () => {
    const r = resumenBonificaciones(conAnexo({ bonificacionesDesde: 'TRAMO_VARIABLE' }), HOY);

    expect(r.rebajanHoy).toBe(false);
    // Y se dice desde cuándo · el arranque del tramo variable, no una fecha
    // inventada: «entonces cuándo» es la pregunta que sigue.
    expect(r.rebajanDesde).toBe('2026-08-25');
  });

  // El tipo que se enseña tachado es el del tramo que SÍ bonifica · el euríbor
  // + diferencial que entra el 25/08, no el 2,600 % que paga hoy.
  it('y el par de tipos es el del tramo que sí bonifica', () => {
    const r = resumenBonificaciones(conAnexo({ bonificacionesDesde: 'TRAMO_VARIABLE' }), HOY);

    expect(r.tinSinBonificar).toBeCloseTo(3.85, 2);
    expect(r.tinConLasQueTienes).toBeCloseTo(2.85, 2);
  });

  // La otra mixta · la de ING, que bonifica desde la firma. Ahí «tu tipo de
  // hoy» sí es verdad, y decir «todavía no rebajan» sería el error simétrico.
  it('una mixta que bonifica desde la firma sí rebaja hoy', () => {
    const r = resumenBonificaciones(conAnexo({ bonificacionesDesde: 'FIRMA' }), HOY);

    expect(r.rebajanHoy).toBe(true);
    expect(r.rebajanDesde).toBeUndefined();
    expect(r.tinSinBonificar).toBeCloseTo(2.6, 2);
    expect(r.tinConLasQueTienes).toBeCloseTo(1.6, 2);
  });

  // Lo que el banco APLICA se va a la tarjeta del tipo · lo que tus movimientos
  // demuestran se queda en la de bonificaciones. Mientras la misma fila
  // contestaba las dos, un check junto a un «no se cumple» parecía un error de
  // la pantalla *(Jose · 9 ago 2026)*.
  it('las que el banco aplica se separan de la lista entera', () => {
    const p = unicaja({
      bonificaciones: [
        bonificacion({ id: 'b1', nombre: 'Nómina' }),
        bonificacion({ id: 'b2', nombre: 'Seguro de hogar', estado: 'PERDIDA' }),
      ],
    });
    const r = resumenBonificaciones(p, HOY);

    expect(r.lista).toHaveLength(2);
    expect(r.aplicadas.map((b) => b.bonificacion.nombre)).toEqual(['Nómina']);
  });

  it('y un fijo simple rebaja siempre', () => {
    const p = personal({ bonificaciones: [bonificacion({ reduccionPuntosPorcentuales: 0.3 })] });

    expect(resumenBonificaciones(p, HOY).rebajanHoy).toBe(true);
  });
});

// ── Lo que vas a pagar si nada cambia ───────────────────────────────────────
//
// El titular daba la rebaja entera por hecha mientras las propias filas de
// debajo decían que dos se van a perder: la tarjeta se contradecía consigo
// misma en la misma pantalla.
describe('resumenBonificaciones · si el banco revisara hoy', () => {
  const dos = (over: Partial<Prestamo> = {}) =>
    unicaja({
      bonificacionesDesde: 'FIRMA',
      bonificaciones: [
        bonificacion({ id: 'b1', reduccionPuntosPorcentuales: 0.5 }),
        bonificacion({ id: 'b2', reduccionPuntosPorcentuales: 0.3 }),
      ],
      ...over,
    });
  const dice = (id: string, veredicto: Cumplimiento['veredicto']): Cumplimiento => ({
    bonificacionId: id,
    nombre: id,
    veredicto,
  });

  it('quita las que no demuestras y recalcula', () => {
    const r = resumenBonificaciones(dos(), HOY, [dice('b1', 'cumple'), dice('b2', 'no_cumple')]);

    expect(r.tinConLasQueTienes).toBeCloseTo(1.8, 2);
    expect(r.tinSiRevisaranHoy).toBeCloseTo(2.1, 2);
  });

  // Lo que NO se puede comprobar no cuesta puntos · un «no lo sé» convertido en
  // «lo pierdes» es el falso negativo de siempre, y aquí sale en el titular.
  it('lo que no se ha podido comprobar no se da por perdido', () => {
    const r = resumenBonificaciones(dos(), HOY, [
      dice('b1', 'cumple'),
      dice('b2', 'no_verificable'),
    ]);

    expect(r.tinSiRevisaranHoy).toBeCloseTo(1.8, 2);
  });

  // Con tope, perder una puede no costar un céntimo · por eso se recalcula
  // entero en vez de restar «los puntos en riesgo» al tipo de hoy.
  it('con tope, perder una bonificación puede no cambiar el tipo', () => {
    const p = dos({ topeBonificacionesTotal: -0.5 });
    const r = resumenBonificaciones(p, HOY, [dice('b1', 'cumple'), dice('b2', 'no_cumple')]);

    expect(r.tinConLasQueTienes).toBeCloseTo(2.1, 2);
    expect(r.tinSiRevisaranHoy).toBeCloseTo(2.1, 2);
  });

  it('y sin haber mirado la tesorería no se afirma ninguna cifra', () => {
    expect(resumenBonificaciones(dos(), HOY).tinSiRevisaranHoy).toBeNull();
  });
});

// ── Fiscalidad ──────────────────────────────────────────────────────────────
//
// Lo que abre la casilla 0105 es el ALQUILER, no el destino *(Jose · 8 ago
// 2026: «la deducción fiscal de un préstamo la genera si el inmueble está
// alquilado, no si el destino es adquisición»)*. El destino dice qué inmueble
// financia el préstamo y qué fracción; el alquiler dice si hay rendimiento del
// que descontar el gasto.

const ALQUILADO = new Set(['inm-1']);
const NINGUNO: ReadonlySet<string> = new Set<string>();

describe('fiscalidadDe · deducible, y por qué no cuando no lo es', () => {
  const compradoConEsteDinero = (inmuebleId: string) =>
    unicaja({
      destinos: [{ id: 'd1', tipo: 'ADQUISICION', inmuebleId, importe: 85000 }],
    } as Partial<Prestamo>);

  it('deducible si el inmueble que financia está alquilado', () => {
    const f = fiscalidadDe(compradoConEsteDinero('inm-1'), ALQUILADO);

    expect(f.deducible).toBe(true);
    expect(f.pctDeducible).toBeCloseTo(100, 0);
  });

  // El caso que la ficha venía contestando mal: la MISMA hipoteca, el mismo
  // destino, el inmueble vacío. Decía «deducible 100%».
  it('y el mismo préstamo, con el inmueble vacío, NO deduce', () => {
    const f = fiscalidadDe(compradoConEsteDinero('inm-1'), NINGUNO);

    expect(f.deducible).toBe(false);
    expect(f.pctDeducible).toBe(0);
    expect(f.motivo).toMatch(/no está alquilado/);
  });

  it('la parte trazada a un inmueble alquilado manda el porcentaje', () => {
    const p = unicaja({
      destinos: [
        { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'inm-1', importe: 42500 },
        { id: 'd2', tipo: 'PERSONAL', importe: 42500 },
      ],
    } as Partial<Prestamo>);

    expect(fiscalidadDe(p, ALQUILADO).pctDeducible).toBeCloseTo(50, 0);
  });

  // Dos inmuebles, uno alquilado y otro no: solo cuenta la mitad que produce.
  it('un inmueble alquilado y otro vacío solo deducen lo que produce', () => {
    const p = unicaja({
      destinos: [
        { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'inm-1', importe: 42500 },
        { id: 'd2', tipo: 'ADQUISICION', inmuebleId: 'inm-2', importe: 42500 },
      ],
    } as Partial<Prestamo>);

    expect(fiscalidadDe(p, ALQUILADO).pctDeducible).toBeCloseTo(50, 0);
  });

  it('un personal NO deducible dice el motivo · es lo que aporta la tarjeta', () => {
    const p = personal({
      destinos: [{ id: 'd1', tipo: 'PERSONAL', importe: 24500 }],
    } as Partial<Prestamo>);
    const f = fiscalidadDe(p, ALQUILADO);

    expect(f.deducible).toBe(false);
    expect(f.motivo).toMatch(/no está trazado a la compra/);
  });

  it('sin destinos apuntados el motivo lo dice · no se calla ni se inventa', () => {
    const f = fiscalidadDe(personal(), ALQUILADO);

    expect(f.deducible).toBe(false);
    expect(f.motivo).toMatch(/no tiene destinos apuntados/);
  });

  // Mientras los contratos no se han leído la respuesta no es «no»: es que
  // todavía no se sabe. Un «no deducible» provisional que luego cambia se lee
  // igual de firme que uno definitivo.
  it('sin saber qué está alquilado no dice ni sí ni no', () => {
    const f = fiscalidadDe(compradoConEsteDinero('inm-1'), undefined);

    expect(f.deducible).toBeNull();
    expect(f.motivo).toBeUndefined();
    // El destino sí se sabe sin mirar contratos · eso se enseña ya.
    expect(f.destino).toMatch(/adquisición/);
  });
});

describe('condicionesDe · solo lo que el papel dice', () => {
  it('no rellena con huecos lo que el préstamo no trae', () => {
    const p = personal();
    const filas = condicionesDe(p, generarCuadro(p));

    expect(filas.map((f) => f.valor)).not.toContain('—');
    expect(filas.find((f) => f.clave === 'Importe inicial')?.valor).toBe('24.500 €');
    expect(filas.find((f) => f.clave === 'Plazo')?.valor).toBe('96 meses');
  });

  it('enseña las comisiones que sí están, y nunca más de seis filas', () => {
    const p = personal({
      interesDemoraPct: 6.5,
      comisionApertura: 1,
      comisionCancelacionTotal: 1,
      comisionAmortizacionAnticipada: 0.5,
      gastoReclamacionImpago: 35,
      garantias: [{ tipo: 'PERSONAL' }],
    } as Partial<Prestamo>);
    const filas = condicionesDe(p, generarCuadro(p));

    expect(filas).toHaveLength(6);
    expect(filas.find((f) => f.clave === 'Interés de demora')?.valor).toBe('6,50 %');
  });
});

describe('lecturas del detalle · progreso, coste e importes', () => {
  it('el progreso cuenta las cuotas ya vencidas', () => {
    const p = personal();
    const progreso = getProgresoCuotas(generarCuadro(p), '2026-03-01');

    expect(progreso.total).toBe(96);
    expect(progreso.pagadas + progreso.restantes).toBe(96);
    // Primera cuota feb 2025 · a marzo de 2026 han vencido 13.
    expect(progreso.pagadas).toBe(13);
  });

  it('el interés pendiente baja según avanza el préstamo', () => {
    const cuadro = generarCuadro(personal());

    expect(getInteresPendiente(cuadro, '2026-03-01')).toBeGreaterThan(
      getInteresPendiente(cuadro, '2029-03-01'),
    );
    expect(getInteresPendiente(cuadro, '2099-01-01')).toBe(0);
  });

  it('el principal inicial se reconstruye del cuadro', () => {
    expect(getPrincipalInicial(generarCuadro(personal()))).toBeCloseTo(24500, 0);
  });

  it('el preview marca el salto de la revisión en un mixto', () => {
    const p = unicaja();
    // Agosto de 2026 · el tramo fijo acaba y el cuadro salta.
    const preview = getPreviewCuadro(generarCuadro(p), '2026-08-01', 3);

    expect(preview).toHaveLength(3);
    expect(preview.some((l) => l.esRevision)).toBe(true);
  });

  it('un fijo no marca ninguna revisión en su preview', () => {
    const preview = getPreviewCuadro(generarCuadro(personal()), '2026-03-01', 3);

    expect(preview.every((l) => !l.esRevision)).toBe(true);
  });
});

// ── El contrato y la prueba son dos preguntas ───────────────────────────────
//
// «Aquí se debe decir las bonificaciones que propone el banco, y tú luego
// comprobarás las que existen» *(Jose · 6 ago 2026)*. Lo que el banco aplica es
// un hecho de tu contrato; si la condición se está cumpliendo lo dicen tus
// movimientos. Cruzarlas es el error que esta pantalla venía cometiendo — una
// casilla marcada valía como prueba.
describe('lo que el banco aplica y lo que se puede demostrar van por separado', () => {
  const conBonif = () =>
    unicaja({
      bonificaciones: [bonificacion({ id: 'b1', nombre: 'Nómina', estado: 'ACTIVO_POR_CUMPLIMIENTO' })],
    });

  it('sin mirar la tesorería la lista sale igual, pero sin veredicto', () => {
    const [b] = resumenBonificaciones(conBonif(), HOY).lista;

    expect(b.bonificacion.nombre).toBe('Nómina');
    expect(b.veredicto).toBeUndefined();
  });

  // El caso que importa: el banco te la está aplicando y tus movimientos dicen
  // que has dejado de cumplirla. Enterarse ANTES de la revisión es la única
  // forma de hacer algo al respecto.
  it('el banco la aplica y los movimientos dicen que no · se enseñan las dos', () => {
    const [b] = resumenBonificaciones(conBonif(), HOY, [
      {
        bonificacionId: 'b1',
        nombre: 'Nómina',
        veredicto: 'no_cumple',
        ventana: { desde: '2026-01-01', hasta: '2026-06-30' },
        motivo: 'no ha entrado ninguna nómina en esa cuenta',
      },
    ]).lista;

    expect(b.alcanzada).toBe(true);
    expect(b.veredicto).toBe('no_cumple');
    expect(b.explicacion).toContain('nómina');
  });

  // Y la tercera respuesta se conserva hasta la pantalla · «no se puede mirar»
  // no es «no se cumple», y pintarlo como un no acusaría de incumplir a quien
  // cumple.
  it('lo que no se puede comprobar se dice, no se convierte en un no', () => {
    const [b] = resumenBonificaciones(conBonif(), HOY, [
      {
        bonificacionId: 'b1',
        nombre: 'Nómina',
        veredicto: 'no_verificable',
        ventana: { desde: '2026-01-01', hasta: '2026-06-30' },
        motivo: 'no dice en qué cuenta hay que domiciliarla',
      },
    ]).lista;

    expect(b.veredicto).toBe('no_verificable');
    // La frase entera, no un motivo suelto · «No se puede comprobar · …».
    expect(b.explicacion).toContain('No se puede comprobar');
    expect(b.explicacion).toContain('cuenta');
  });

  // La discrepancia al revés, y es la que tiene dinero detrás: la cumples y el
  // banco no te la está aplicando, o sea que estás pagando más TIN del que te
  // toca. Se arregla llamando al banco — pero solo si alguien te lo dice.
  it('la cumples y NO te la aplican · las dos cosas constan', () => {
    const p = unicaja({
      bonificaciones: [bonificacion({ id: 'b1', nombre: 'Nómina', estado: 'INACTIVO' })],
    });
    const [b] = resumenBonificaciones(p, HOY, [
      {
        bonificacionId: 'b1',
        nombre: 'Nómina',
        veredicto: 'cumple',
        ventana: { desde: '2026-01-01', hasta: '2026-06-30' },
      },
    ]).lista;

    expect(b.alcanzada).toBe(false);
    expect(b.veredicto).toBe('cumple');
  });

  it('un cumplimiento de otra bonificación no se le pega a esta', () => {
    const [b] = resumenBonificaciones(conBonif(), HOY, [
      {
        bonificacionId: 'otra',
        nombre: 'Tarjeta',
        veredicto: 'no_cumple',
        ventana: { desde: '2026-01-01', hasta: '2026-06-30' },
      },
    ]).lista;

    expect(b.veredicto).toBeUndefined();
  });
});

// ── Cuando el banco y tus movimientos no dicen lo mismo ─────────────────────
//
// La fila enseñaba una marca de cumplida y a la vez un «no se cumple», y se
// leía como que la pantalla se contradice *(Jose · 8 ago 2026)*. No se
// contradice: son dos voces. La marca es lo que el banco APLICA —un hecho del
// contrato— y el aviso es lo que demuestran tus recibos. Que no coincidan es
// justo el caso que hay que mirar, y por eso la pantalla lo señala.

const conVeredicto = (
  veredicto: Cumplimiento['veredicto'] | undefined,
  alcanzada: boolean
): BonificacionDetalle =>
  ({ bonificacion: bonificacion(), alcanzada, puntos: 0.3, veredicto }) as BonificacionDetalle;

describe('hayDiscrepancia · las dos voces', () => {
  // El caso caro: la estás cobrando y no la demuestras · la pierdes en la
  // próxima revisión y la cuota sube.
  it('te la aplican y no la cumples', () => {
    expect(hayDiscrepancia(conVeredicto('no_cumple', true))).toBe(true);
  });

  // El caso al revés: la cumples y no te la aplican · estás pagando de más.
  it('la cumples y no te la aplican', () => {
    expect(hayDiscrepancia(conVeredicto('cumple', false))).toBe(true);
  });

  it.each([
    ['cumple', true],
    ['no_cumple', false],
  ] as const)('y si coinciden (%s / aplicada=%s), no hay nada que aclarar', (v, a) => {
    expect(hayDiscrepancia(conVeredicto(v, a))).toBe(false);
  });

  // «No verificable» no afirma lo contrario · dice que no se ha podido mirar, y
  // tratarlo como desacuerdo pondría un aviso donde no hay noticia.
  it('no haberlo podido comprobar no es un desacuerdo', () => {
    expect(hayDiscrepancia(conVeredicto('no_verificable', true))).toBe(false);
    expect(hayDiscrepancia(conVeredicto('no_verificable', false))).toBe(false);
  });

  it('ni tampoco no haber mirado todavía', () => {
    expect(hayDiscrepancia(conVeredicto(undefined, true))).toBe(false);
  });
});

// Cuándo se pierde · la fecha se enseña como se sepa, no como se quiera.
describe('cuandoSePierde · con el día si lo hay, con el mes si no', () => {
  it('con día, lo dice', () => {
    expect(cuandoSePierde({ fecha: '2026-08-25', precision: 'dia' } as Revision)).toBe(
      'la pierdes el 25 ago 2026'
    );
  });

  // Una revisión que solo se sabe por meses contesta `2026-11`, y un formateador
  // de día sobre eso escribía «la pierdes el —».
  it('y con solo el mes, el mes · nunca un guion', () => {
    const texto = cuandoSePierde({ fecha: '2026-11', precision: 'mes' } as Revision);

    expect(texto).toBe('la pierdes en nov 2026');
    expect(texto).not.toMatch(/—/);
  });

  // Sin saber cuándo revisa el banco no hay fecha que poner · pero el aviso
  // sigue haciendo falta, porque la discrepancia existe igual.
  it('y sin revisión conocida, lo dice sin fecha', () => {
    expect(cuandoSePierde(null)).toBe('te la aplican · no la demuestras');
  });
});
