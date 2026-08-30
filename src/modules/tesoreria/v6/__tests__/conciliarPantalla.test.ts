// Candados de la pantalla de conciliar (mockup `atlas-conciliar-v1.html`).
//
// Lo que se protege aquí no es el aspecto: es que la pantalla no MIENTA. Tres
// mentiras posibles, una por bloque:
//   · enseñar jerga interna (una casilla de la AEAT, un `categoryKey` crudo);
//   · sacar una línea de «te necesitan» sin que el usuario lo haya decidido;
//   · prometer que algo «se recordará» cuando no se escribe ninguna regla.

import { bucketDeLinea, cuadre } from '../conciliarBuckets';
import { decisionesVacias, type LineaExtracto } from '../extractoSesion';
import {
  propuestaDeLinea,
  esPersonalReconocido,
  etiquetaDeCategoria,
} from '../conciliar/propuestaDeLinea';
import { agruparResueltas, claveDeGrupo } from '../conciliar/agruparResueltas';
import { loQueYaReconoce } from '../conciliar/loQueYaReconoce';
import type { MovementSuggestion } from '../../../../services/movementSuggestionService';
import type { MovementLearningRule } from '../../../../services/db/types-movimientos';

const linea = (id: number, extra: Partial<LineaExtracto> = {}): LineaExtracto => ({
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: `LINEA ${id}`,
  fecha: '2026-08-03',
  importe: -100,
  veredicto: 'resolver',
  ...extra,
});

const sug = (over: Partial<MovementSuggestion>): MovementSuggestion => ({
  movementId: 1,
  via: 'heuristica',
  confidence: 30,
  description: '',
  action: { kind: 'ignore' },
  ...over,
});

const regla = (over: Partial<MovementLearningRule> = {}): MovementLearningRule => ({
  learnKey: 'k',
  counterpartyPattern: 'EMILIO CARRERA',
  descriptionPattern: '',
  amountSign: 'positive',
  categoria: 'comunidad_inmueble',
  ambito: 'INMUEBLE',
  source: 'IMPLICIT',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  appliedCount: 3,
  ...over,
});

describe('sin jerga · el usuario nunca lee el nombre interno de un campo', () => {
  it('traduce el categoryKey a la palabra del catálogo', () => {
    expect(etiquetaDeCategoria('comunidad_inmueble')).toBe('Comunidad');
  });

  it('prefiere callarse a enseñar la clave cruda cuando no la conoce', () => {
    expect(etiquetaDeCategoria('clave_que_no_existe_en_el_catalogo')).toBeNull();
  });

  it('ninguna frase de la tarjeta lleva casilla de la AEAT ni clave con guion bajo', () => {
    const casos: MovementSuggestion[][] = [
      [sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', categoryKey: 'comunidad_inmueble' } })],
      [sug({ via: 'compromiso_recurrente', confidence: 75, action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', categoryKey: 'comunidad_inmueble', sourceType: 'gasto' } })],
      [sug({ via: 'heuristica', confidence: 60, action: { kind: 'assign_to_contract' } })],
      [],
    ];
    for (const c of casos) {
      const p = propuestaDeLinea(c);
      const texto = `${p.titular} ${p.ayuda}`;
      expect(texto).not.toMatch(/\b0\d{3}\b/);       // casillas AEAT
      expect(texto).not.toMatch(/[a-z]+_[a-z]+/);    // claves internas
    }
  });
});

describe('la tarjeta no promete lo que no cumple', () => {
  it('la heurística NO dice que se recordará · no escribe regla', () => {
    expect(propuestaDeLinea([sug({ via: 'heuristica', confidence: 60, action: { kind: 'assign_to_contract' } })]).seRecuerda).toBe(false);
  });

  it('una regla aprendida sí se recuerda', () => {
    expect(
      propuestaDeLinea([
        sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', categoryKey: 'comunidad_inmueble' } }),
      ]).seRecuerda,
    ).toBe(true);
  });

  it('sin ninguna sugerencia sigue habiendo tarjeta · pregunta abierta', () => {
    const p = propuestaDeLinea([]);
    expect(p.tono).toBe('pregunta');
    expect(p.titular).toContain('No sé qué es');
  });

  it('el recurrente pide confirmación, no propone a ciegas', () => {
    expect(
      propuestaDeLinea([
        sug({ via: 'compromiso_recurrente', confidence: 75, action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', categoryKey: 'comunidad_inmueble', sourceType: 'gasto' } }),
      ]).tono,
    ).toBe('confirma');
  });

  it('manda la sugerencia de más confianza', () => {
    const p = propuestaDeLinea([
      sug({ via: 'heuristica', confidence: 30, action: { kind: 'ignore' } }),
      sug({ via: 'learning_rule', confidence: 85, action: { kind: 'assign_to_contract' } }),
    ]);
    expect(p.titular).toContain('renta');
  });
});

describe('personal · solo por lo que el usuario enseñó', () => {
  it('una regla aprendida que dice personal cuenta', () => {
    expect(
      esPersonalReconocido([
        sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', categoryKey: 'x' } }),
      ]),
    ).toBe(true);
  });

  it('la heurística de Amazon NO cuenta · nadie ha decidido nada', () => {
    expect(
      esPersonalReconocido([
        sug({ via: 'heuristica', confidence: 50, action: { kind: 'mark_personal_expense', categoryKey: 'tecnologia' } }),
      ]),
    ).toBe(false);
  });

  it('esa línea de Amazon se queda en «te necesitan», no se esconde', () => {
    const l = linea(1);
    expect(bucketDeLinea(l, decisionesVacias(), new Set())).toBe('te_necesitan');
  });
});

describe('el cuadre aguanta con el cuarto montón lleno', () => {
  it('124 del banco = 124 colocadas, con personales dentro', () => {
    const lineas = Array.from({ length: 124 }, (_, i) => linea(i + 1, i < 40 ? { veredicto: 'cuadra' } : {}));
    const personales = new Set(lineas.slice(60, 92).map((l) => l.movementId));
    const c = cuadre(lineas, decisionesVacias(), personales);
    expect(c.delBanco).toBe(124);
    expect(c.colocadas).toBe(124);
    expect(c.porBucket.personal).toBe(32);
    expect(c.cuadra).toBe(true);
    expect(c.huerfanas).toEqual([]);
  });

  it('lo ignorado gana a lo personal · el acto del usuario manda', () => {
    const l = linea(7);
    const d = decisionesVacias();
    d.ignorados.add(7);
    expect(bucketDeLinea(l, d, new Set([7]))).toBe('ignorados');
  });

  it('lo que cuadró no se saca de resueltas por ser personal', () => {
    const l = linea(8, { veredicto: 'cuadra' });
    expect(bucketDeLinea(l, decisionesVacias(), new Set([8]))).toBe('resueltas');
  });
});

describe('el resumen de la derecha · agrupa por lo que ATLAS sabe que es', () => {
  it('dos cuotas del mismo préstamo son UN grupo, aunque el banco escriba el número', () => {
    expect(claveDeGrupo('Cuota préstamo 3/240')).toBe(claveDeGrupo('Cuota préstamo 4/240'));
  });

  it('cuenta y suma el grupo', () => {
    const g = agruparResueltas([
      linea(1, { veredicto: 'cuadra', importe: -454.66, previsto: { id: 1, descripcion: 'Cuota préstamo 3/240', importe: -454.66, fecha: '2026-08-01' } }),
      linea(2, { veredicto: 'cuadra', importe: -253.97, previsto: { id: 2, descripcion: 'Cuota préstamo 4/240', importe: -253.97, fecha: '2026-08-01' } }),
      linea(3, { veredicto: 'cuadra', importe: 3940, previsto: { id: 3, descripcion: 'Nómina', importe: 3940, fecha: '2026-08-25' } }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].cuantas).toBe(2);
    expect(g[0].total).toBeCloseTo(-708.63, 2);
  });

  it('cuando no casó con nada, el título es el texto literal del banco', () => {
    const g = agruparResueltas([linea(9, { veredicto: 'cuadra', textoBanco: 'ADEUDO RECIBO AQUALIA' })]);
    expect(g[0].titulo).toBe('ADEUDO RECIBO AQUALIA');
  });

  it('el detalle no repite el título · cuatro cargos de la misma luz dan fechas', () => {
    const g = agruparResueltas([
      linea(1, { veredicto: 'cuadra', textoBanco: 'Gas', fecha: '2026-08-03' }),
      linea(2, { veredicto: 'cuadra', textoBanco: 'Gas', fecha: '2026-08-17' }),
    ]);
    expect(g[0].titulo).toBe('Gas');
    expect(g[0].detalle).not.toBe('Gas');
    expect(g[0].detalle).toBe('2026-08-03 a 2026-08-17');
  });

  it('con nombres distintos dentro del grupo sí los lista · ahí el detalle informa', () => {
    // Mismo grupo (la clave ignora los números) pero nombres literales distintos.
    const g = agruparResueltas([
      linea(1, { veredicto: 'cuadra', previsto: { id: 1, descripcion: 'Cuota préstamo 3/240', importe: -454, fecha: '2026-08-01' } }),
      linea(2, { veredicto: 'cuadra', previsto: { id: 2, descripcion: 'Cuota préstamo 4/240', importe: -253, fecha: '2026-09-01' } }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].detalle).toContain('3/240');
    expect(g[0].detalle).toContain('4/240');
  });

  it('una sola línea del mismo día no inventa un rango', () => {
    const g = agruparResueltas([linea(1, { veredicto: 'cuadra', fecha: '2026-08-03' })]);
    expect(g[0].detalle).toBe('2026-08-03');
  });
});

describe('«la próxima vez, sola» · dice la verdad de lo aprendido', () => {
  const ABRE = '2026-08-30T08:00:00.000Z';

  it('separa lo de esta sesión de lo de antes', () => {
    const r = loQueYaReconoce(
      [regla({ id: 1, updatedAt: '2026-08-30T09:00:00.000Z' }), regla({ id: 2 }), regla({ id: 3 })],
      ABRE,
    );
    expect(r.nuevas).toHaveLength(1);
    expect(r.deAntes).toBe(2);
    expect(r.total).toBe(3);
  });

  it('con el store vacío no inventa nada', () => {
    const r = loQueYaReconoce([], ABRE);
    expect(r.total).toBe(0);
    expect(r.nuevas).toEqual([]);
  });

  it('enseña el nombre canónico del inquilino, no la abreviatura del banco', () => {
    const r = loQueYaReconoce(
      [regla({ id: 1, updatedAt: '2026-08-30T09:00:00.000Z', aliasContraparte: 'BIZUM DE ADNAN PARWEZ', contraparteCanonica: 'Adnan Parwez Khan' })],
      ABRE,
    );
    expect(r.nuevas[0].quien).toBe('Adnan Parwez Khan');
  });

  it('la categoría sale en cristiano, con el piso', () => {
    const r = loQueYaReconoce(
      [regla({ id: 1, updatedAt: '2026-08-30T09:00:00.000Z', inmuebleId: '4' })],
      ABRE,
      new Map([['4', 'Carles Buigas 15']]),
    );
    expect(r.nuevas[0].enQue).toBe('Comunidad de Carles Buigas 15');
  });
});
