// Qué demuestran los movimientos de cada bonificación · VOCABULARIO §6 ter y §3.6.
//
// Aquí se decide una cifra que se presume ante un banco. Lo que vigilan estos
// tests es que no se dé por probado nada que no lo esté: ni una tarjeta de
// fuera, ni un periodo que todavía puede crecer, ni una condición que nadie
// sabe mirar.

import { verificarBonificaciones } from '../verificarBonificaciones';
import type { MovimientosQuePrueban } from '../verificarBonificaciones';
import type { GastoDeUnPeriodo } from '../../gastoPorTarjeta';
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
  aplicaEn: 'FIJO',
  lookbackMeses: 6,
  regla: { tipo: 'TARJETA', importeMinimo: 3000 },
  estado: 'SELECCIONADO',
  tarjetaExigidaId: 7,
  ...over,
});

const con = (tarjetas: Tarjeta[], periodos: GastoDeUnPeriodo[]): MovimientosQuePrueban => ({
  tarjetas,
  periodosDeTarjeta: periodos,
});

const unaSola = (b: Bonificacion, m: MovimientosQuePrueban) =>
  verificarBonificaciones([b], m, HOY)[0];

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

  // §6 ter · «nómina domiciliada, recibos domiciliados, seguros contratados…
  // todos son condiciones que se verifican contra la tesorería, y hoy nadie las
  // mira». Que nadie las mire se dice; no se dan por buenas ni por perdidas.
  it('las condiciones sin fuente se nombran una a una', () => {
    const nomina = unaSola(
      bonif({ regla: { tipo: 'NOMINA', minimoMensual: 1200 } }),
      con([tarjeta()], [])
    );
    const seguro = unaSola(
      bonif({ regla: { tipo: 'SEGURO_HOGAR', activo: true } }),
      con([tarjeta()], [])
    );

    expect(nomina.veredicto).toBe('no_verificable');
    expect(nomina.motivo).toContain('nómina');
    expect(seguro.motivo).toContain('póliza');
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
