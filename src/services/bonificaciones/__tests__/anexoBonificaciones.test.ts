// ============================================================================
// Lo que el ANEXO dice sobre el conjunto · cascada, sublímite y escalones
// ============================================================================
//
// Tres cosas que un anexo pacta y que el modelo no sabía guardar, así que se
// guardaban como si no existieran. Las tres se equivocan en la misma dirección
// —enseñan una cuota MÁS BAJA de la que el banco cobra— y sobre esa cifra se
// hacen cuentas:
//
//   · **Cascada** · «se aplicará el escalón siguiente únicamente si se mantiene
//     el anterior». Sumadas como independientes, perder la primera no quitaba
//     las de debajo.
//   · **Sublímite** · «por domiciliaciones, hasta 0,30 p.p.», dentro de un
//     anexo que además no baja de un punto en total. Sin él, una rebaja se
//     pasaba de su propio máximo mientras el total cupiera bajo el tope.
//   · **Escalones** · la rebaja que sube con lo que aportas. Guardar solo la
//     mayor rebaja de más; solo la menor, de menos.
// ============================================================================

import { bonificacionesQueCuentan, puntosDe, reduccionPorBonificaciones } from '../tinEfectivo';
import type { Bonificacion } from '../../../types/prestamos';

const bonif = (over: Partial<Bonificacion> = {}): Bonificacion => ({
  id: 'b1',
  tipo: 'NOMINA',
  nombre: 'Ingresos domiciliados',
  reduccionPuntosPorcentuales: 0.3,
  impacto: { puntos: -0.3 },
  lookbackMeses: 6,
  regla: { tipo: 'NOMINA', minimoMensual: 1200 },
  estado: 'SELECCIONADO',
  ...over,
});

describe('en cascada, la primera que no cumples corta las de debajo', () => {
  const tres = [
    bonif({ id: 'a', orden: 0, reduccionPuntosPorcentuales: 0.3 }),
    bonif({ id: 'b', orden: 1, reduccionPuntosPorcentuales: 0.2, estado: 'PERDIDA' }),
    bonif({ id: 'c', orden: 2, reduccionPuntosPorcentuales: 0.5 }),
  ];

  it('solo cuentan las que van antes de la rota', () => {
    expect(bonificacionesQueCuentan(tres, 'CASCADA').map((b) => b.id)).toEqual(['a']);
    expect(reduccionPorBonificaciones(tres, { modoBonificaciones: 'CASCADA' })).toBe(0.3);
  });

  // La misma lista en independientes sí suma la tercera · son dos contratos
  // distintos, y por eso el modo se guarda.
  it('en independientes, la de después sí cuenta', () => {
    expect(reduccionPorBonificaciones(tres)).toBe(0.8);
    expect(reduccionPorBonificaciones(tres, { modoBonificaciones: 'INDEPENDIENTES' })).toBe(0.8);
  });

  it('el orden es el del anexo, no el de la lista', () => {
    const desordenadas = [
      bonif({ id: 'ultima', orden: 2, reduccionPuntosPorcentuales: 0.5 }),
      bonif({ id: 'rota', orden: 1, estado: 'PERDIDA' }),
      bonif({ id: 'primera', orden: 0, reduccionPuntosPorcentuales: 0.1 }),
    ];
    expect(bonificacionesQueCuentan(desordenadas, 'CASCADA').map((b) => b.id)).toEqual(['primera']);
  });

  // `orden` ausente se lee como la posición guardada · es el orden en que se
  // ven en pantalla, y suponer otro cambiaría a quién corta la rota.
  it('sin `orden`, manda la posición en la lista', () => {
    const sinOrden = [
      bonif({ id: 'a' }),
      bonif({ id: 'b', estado: 'PERDIDA' }),
      bonif({ id: 'c' }),
    ];
    expect(bonificacionesQueCuentan(sinOrden, 'CASCADA').map((b) => b.id)).toEqual(['a']);
  });

  it('si la primera está rota, no cuenta ninguna', () => {
    const rotaLaPrimera = [bonif({ id: 'a', estado: 'PERDIDA' }), bonif({ id: 'b' })];
    expect(reduccionPorBonificaciones(rotaLaPrimera, { modoBonificaciones: 'CASCADA' })).toBe(0);
  });

  // El tope del anexo sigue capando después de la cascada · son dos cláusulas
  // distintas y las dos están escritas.
  it('y el tope del anexo sigue capando lo que quede', () => {
    const dos = [
      bonif({ id: 'a', orden: 0, reduccionPuntosPorcentuales: 0.7 }),
      bonif({ id: 'b', orden: 1, reduccionPuntosPorcentuales: 0.6 }),
    ];
    expect(
      reduccionPorBonificaciones(dos, { modoBonificaciones: 'CASCADA', topeBonificacionesTotal: -1 }),
    ).toBe(1);
  });
});

describe('el sublímite capa UNA bonificación, no la suma', () => {
  it('recorta la que se pasa de su propio máximo', () => {
    expect(puntosDe(bonif({ reduccionPuntosPorcentuales: 0.5, sublimitePP: 0.3 }))).toBe(0.3);
  });

  it('y no toca la que cabe', () => {
    expect(puntosDe(bonif({ reduccionPuntosPorcentuales: 0.2, sublimitePP: 0.3 }))).toBe(0.2);
  });

  // El caso que lo justifica: dos cláusulas a la vez. Sin sublímite el total
  // sería 0,5 + 0,4 = 0,9, por debajo del tope, así que el tope no lo habría
  // detectado.
  it('actúa aunque el total quepa bajo el tope del anexo', () => {
    const dos = [
      bonif({ id: 'a', reduccionPuntosPorcentuales: 0.5, sublimitePP: 0.3 }),
      bonif({ id: 'b', reduccionPuntosPorcentuales: 0.4 }),
    ];
    expect(reduccionPorBonificaciones(dos, { topeBonificacionesTotal: -1 })).toBe(0.7);
  });

  it('un sublímite en cero o ausente no capa nada', () => {
    expect(puntosDe(bonif({ reduccionPuntosPorcentuales: 0.5, sublimitePP: 0 }))).toBe(0.5);
    expect(puntosDe(bonif({ reduccionPuntosPorcentuales: 0.5 }))).toBe(0.5);
  });
});

describe('los escalones · la rebaja que sube con lo que aportas', () => {
  const porTramos = (minimoMensual: number): Bonificacion =>
    bonif({
      reduccionPuntosPorcentuales: 0.9, // la cifra fija NO manda cuando hay escalones
      regla: { tipo: 'NOMINA', minimoMensual },
      rebajaPorTramos: [
        { desde: 1000, pp: 0.1 },
        { desde: 2000, pp: 0.3 },
        { desde: 3000, pp: 0.5 },
      ],
    });

  it('rige el escalón que el umbral alcanza', () => {
    expect(puntosDe(porTramos(2500))).toBe(0.3);
    expect(puntosDe(porTramos(3000))).toBe(0.5);
    expect(puntosDe(porTramos(1000))).toBe(0.1);
  });

  // Por debajo del primero el anexo no promete nada · «desde 2.000 €» no dice
  // qué le da a quien domicilie mil.
  it('por debajo del primer escalón no rebaja nada', () => {
    expect(puntosDe(porTramos(500))).toBe(0);
  });

  it('los escalones mandan sobre la cifra fija', () => {
    expect(puntosDe(porTramos(2500))).not.toBe(0.9);
  });

  // Sin umbral declarado no se elige escalón: coger el alto enseñaría una cuota
  // más baja de la que se paga, que es el error que sí arruina un mes.
  it('sin umbral declarado no se elige ninguno', () => {
    const sinUmbral = bonif({
      regla: { tipo: 'ALARMA', activo: true },
      rebajaPorTramos: [{ desde: 0, pp: 0.4 }],
    });
    expect(puntosDe(sinUmbral)).toBe(0);
  });

  it('el escalón también respeta el sublímite', () => {
    const b = { ...porTramos(3000), sublimitePP: 0.25 };
    expect(puntosDe(b)).toBe(0.25);
  });

  // El orden en que estén guardados no puede cambiar cuál rige.
  it('el orden en que se guarden los escalones da igual', () => {
    const desordenados = bonif({
      regla: { tipo: 'NOMINA', minimoMensual: 2500 },
      rebajaPorTramos: [
        { desde: 3000, pp: 0.5 },
        { desde: 1000, pp: 0.1 },
        { desde: 2000, pp: 0.3 },
      ],
    });
    expect(puntosDe(desordenados)).toBe(0.3);
  });
});

describe('los umbrales de las condiciones nuevas', () => {
  const conEscalon = (regla: Bonificacion['regla']): Bonificacion =>
    bonif({ regla, rebajaPorTramos: [{ desde: 100, pp: 0.2 }] });

  it('el saldo en fondos elige escalón', () => {
    expect(puntosDe(conEscalon({ tipo: 'FONDOS', saldoMinimo: 30000 }))).toBe(0.2);
    expect(puntosDe(conEscalon({ tipo: 'FONDOS' }))).toBe(0);
  });

  it('la prima del seguro de hogar y el capital del de vida, también', () => {
    expect(puntosDe(conEscalon({ tipo: 'SEGURO_HOGAR', activo: true, primaAnual: 199 }))).toBe(0.2);
    expect(
      puntosDe(conEscalon({ tipo: 'SEGURO_VIDA', activo: true, capitalAseguradoPct: 100 })),
    ).toBe(0.2);
  });

  // Una letra no es una cantidad · traducirla a una escala numérica propia
  // sería inventarse una equivalencia que nadie ha escrito.
  it('la letra de un certificado no elige escalón', () => {
    expect(puntosDe(conEscalon({ tipo: 'CERTIFICADO_ENERGETICO', letraMinima: 'A' }))).toBe(0);
  });
});
