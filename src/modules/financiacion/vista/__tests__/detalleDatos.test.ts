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
import { condicionesDe, fiscalidadDe, lineaDeTiempo, resumenBonificaciones } from '../detalleDatos';
import type { Bonificacion, Prestamo } from '../../../../types/prestamos';

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
    expect(resumenBonificaciones(personal()).lista).toHaveLength(0);
  });

  it('lista TODAS · las que faltan también, que son las que puedes ir a buscar', () => {
    const p = unicaja({
      bonificaciones: [
        bonificacion(),
        bonificacion({ id: 'b2', nombre: 'Seguro de hogar', estado: 'PERDIDA' }),
      ],
    });
    const r = resumenBonificaciones(p);

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

    expect(resumenBonificaciones(p).rebajaTotal).toBeCloseTo(0.5, 3);
  });

  it('el tope del anexo capa la suma · no se rebaja más de lo pactado', () => {
    const p = unicaja({
      topeBonificacionesTotal: -1,
      bonificaciones: [
        bonificacion({ reduccionPuntosPorcentuales: 0.8 }),
        bonificacion({ id: 'b2', reduccionPuntosPorcentuales: 0.7 }),
      ],
    });
    const r = resumenBonificaciones(p);

    expect(r.tope).toBeCloseTo(1, 3);
    expect(r.rebajaTotal).toBeCloseTo(1, 3);
  });
});

describe('fiscalidadDe · deducible, y por qué no cuando no lo es', () => {
  it('deducible si el capital está trazado a un inmueble', () => {
    const p = unicaja({
      destinos: [
        { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'inm-1', importe: 85000 },
      ],
    } as Partial<Prestamo>);
    const f = fiscalidadDe(p);

    expect(f.deducible).toBe(true);
    expect(f.pctDeducible).toBeCloseTo(100, 0);
  });

  it('la parte trazada manda el porcentaje', () => {
    const p = unicaja({
      destinos: [
        { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'inm-1', importe: 42500 },
        { id: 'd2', tipo: 'PERSONAL', importe: 42500 },
      ],
    } as Partial<Prestamo>);

    expect(fiscalidadDe(p).pctDeducible).toBeCloseTo(50, 0);
  });

  it('un personal NO deducible dice el motivo · es lo que aporta la tarjeta', () => {
    const p = personal({
      destinos: [{ id: 'd1', tipo: 'PERSONAL', importe: 24500 }],
    } as Partial<Prestamo>);
    const f = fiscalidadDe(p);

    expect(f.deducible).toBe(false);
    expect(f.motivo).toMatch(/no está trazado a un inmueble/);
  });

  it('sin destinos apuntados el motivo lo dice · no se calla ni se inventa', () => {
    const f = fiscalidadDe(personal());

    expect(f.deducible).toBe(false);
    expect(f.motivo).toMatch(/no tiene destinos apuntados/);
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
