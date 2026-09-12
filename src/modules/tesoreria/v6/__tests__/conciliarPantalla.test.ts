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
  propuestasDeLineas,
  esPersonalReconocido,
  etiquetaDeCategoria,
} from '../conciliar/propuestaDeLinea';
import { claveDeGrupo } from '../conciliar/agruparResueltas';
import { agruparPorEntidad } from '../conciliar/agruparPorEntidad';
import { loQueYaReconoce } from '../conciliar/loQueYaReconoce';
import type { MovementSuggestion } from '../../../../services/movementSuggestionService';
import type { MovementLearningRule } from '../../../../services/db/types-movimientos';
import type { ClasificacionLinea } from '../../../../services/clasificacion/tipos';

const linea = (id: number, extra: Partial<LineaExtracto> = {}): LineaExtracto => ({
  lineaId: 100 + id,
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
  familia: 'comunidad',
  ambito: 'inmueble',
  source: 'IMPLICIT',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  appliedCount: 3,
  ...over,
});

describe('sin jerga · el usuario nunca lee el nombre interno de un campo', () => {
  it('traduce la familia a la palabra del catálogo', () => {
    expect(etiquetaDeCategoria('comunidad')).toBe('Comunidad');
    expect(etiquetaDeCategoria('suministro', 'luz')).toBe('Suministro · Luz');
  });

  it('prefiere callarse a enseñar la clave cruda cuando no la conoce', () => {
    expect(etiquetaDeCategoria('clave_que_no_existe_en_el_catalogo')).toBeNull();
  });

  it('ninguna frase de la tarjeta lleva casilla de la AEAT ni clave con guion bajo', () => {
    const casos: MovementSuggestion[][] = [
      [sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', familia: 'comunidad' } })],
      [sug({ via: 'compromiso_recurrente', confidence: 75, action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', familia: 'comunidad', sourceType: 'gasto' } })],
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
        sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', familia: 'comunidad' } }),
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
        sug({ via: 'compromiso_recurrente', confidence: 75, action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', familia: 'comunidad', sourceType: 'gasto' } }),
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

describe('FASE 2 · el piso que dice tu declaración llega a la tarjeta', () => {
  const atrib = { alias: 'Tenderina', concepto: 'IBI', ejercicio: 2025 };

  it('sin ninguna sugerencia, la declaración ya dice qué parece', () => {
    const p = propuestaDeLinea([], atrib);
    expect(p.titular).toContain('ibi');
    expect(p.ayuda).toContain('Tenderina');
    expect(p.ayuda).toContain('2025');
  });

  it('con sugerencia, se suma al porqué sin pisar el titular', () => {
    const p = propuestaDeLinea(
      [sug({ via: 'learning_rule', confidence: 85, action: { kind: 'assign_to_contract' } })],
      atrib,
    );
    expect(p.titular).toContain('renta');
    expect(p.ayuda).toContain('Tenderina');
  });

  it('sin piso conocido no se inventa un alias', () => {
    const p = propuestaDeLinea([], { concepto: 'Comunidad', ejercicio: 2025 });
    expect(p.ayuda).toContain('uno de tus pisos');
  });

  it('sin atribución, la frase de siempre', () => {
    expect(propuestaDeLinea([]).ayuda).toContain('subes la factura');
  });
});

describe('personal · solo por lo que el usuario enseñó', () => {
  it('una regla aprendida que dice personal cuenta', () => {
    expect(
      esPersonalReconocido([
        sug({ via: 'learning_rule', confidence: 85, action: { kind: 'mark_personal_expense', familia: 'x' } }),
      ]),
    ).toBe(true);
  });

  it('la heurística de Amazon NO cuenta · nadie ha decidido nada', () => {
    expect(
      esPersonalReconocido([
        sug({ via: 'heuristica', confidence: 50, action: { kind: 'mark_personal_expense', familia: 'compra_online' } }),
      ]),
    ).toBe(false);
  });

  it('esa línea de Amazon se queda en «te necesitan», no se esconde', () => {
    const l = linea(1);
    expect(bucketDeLinea(l, decisionesVacias(), new Set())).toBe('te_necesitan');
  });
});

describe('FASE 2 · lo reconocido contra los libros del usuario', () => {
  it('una cuota de préstamo reconocida cae en «resueltas», no en «te necesitan»', () => {
    const l = linea(1);
    expect(bucketDeLinea(l, decisionesVacias(), new Set(), new Set([101]))).toBe('resueltas');
  });

  it('sin reconocer sigue pidiendo al usuario', () => {
    expect(bucketDeLinea(linea(1), decisionesVacias(), new Set(), new Set())).toBe('te_necesitan');
  });

  it('lo que el usuario ignoró manda sobre lo reconocido', () => {
    const d = decisionesVacias();
    d.ignorados.add(101);
    expect(bucketDeLinea(linea(1), d, new Set(), new Set([101]))).toBe('ignorados');
  });

  it('saber QUÉ es pesa más que saber de quién es', () => {
    // Reconocida Y marcada personal · manda el reconocimiento.
    expect(bucketDeLinea(linea(1), decisionesVacias(), new Set([101]), new Set([101]))).toBe('resueltas');
  });

  it('el cuadre sigue en pie con líneas reconocidas', () => {
    const lineas = Array.from({ length: 102 }, (_, i) => linea(i + 1));
    const c = cuadre(lineas, decisionesVacias(), new Set(), new Set([101, 102, 103, 104, 105]));
    expect(c.delBanco).toBe(102);
    expect(c.colocadas).toBe(102);
    expect(c.porBucket.resueltas).toBe(5);
    expect(c.porBucket.te_necesitan).toBe(97);
    expect(c.cuadra).toBe(true);
  });
});

describe('el cuadre aguanta con el cuarto montón lleno', () => {
  it('124 del banco = 124 colocadas, con personales dentro', () => {
    const lineas = Array.from({ length: 124 }, (_, i) => linea(i + 1, i < 40 ? { veredicto: 'cuadra' } : {}));
    const personales = new Set(lineas.slice(60, 92).map((l) => l.lineaId));
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
    d.ignorados.add(107);
    expect(bucketDeLinea(l, d, new Set([107]))).toBe('ignorados');
  });

  it('lo que cuadró no se saca de resueltas por ser personal', () => {
    const l = linea(8, { veredicto: 'cuadra' });
    expect(bucketDeLinea(l, decisionesVacias(), new Set([108]))).toBe('resueltas');
  });
});

describe('«Colocado en su sitio» · agrupa por ENTIDAD, por lo que ATLAS sabe que es', () => {
  it('dos cuotas del mismo préstamo son UN grupo, aunque el banco escriba el número', () => {
    expect(claveDeGrupo('Cuota préstamo 3/240')).toBe(claveDeGrupo('Cuota préstamo 4/240'));
  });

  it('cuenta y suma la entidad', () => {
    const g = agruparPorEntidad([
      linea(1, { veredicto: 'cuadra', importe: -454.66, previsto: { id: 1, descripcion: 'Cuota préstamo 3/240', importe: -454.66, fecha: '2026-08-01' } }),
      linea(2, { veredicto: 'cuadra', importe: -253.97, previsto: { id: 2, descripcion: 'Cuota préstamo 4/240', importe: -253.97, fecha: '2026-08-01' } }),
      linea(3, { veredicto: 'cuadra', importe: 3940, previsto: { id: 3, descripcion: 'Nómina', importe: 3940, fecha: '2026-08-25' } }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].cuantas).toBe(2);
    expect(g[0].total).toBeCloseTo(-708.63, 2);
    expect(g[0].nombre).toBe('Cuota préstamo 3/240');
  });

  it('cuando no casó con nada ni tiene identificador, el nombre es la contraparte del banco', () => {
    const g = agruparPorEntidad([linea(9, { veredicto: 'cuadra', textoBanco: 'ADEUDO RECIBO AQUALIA' })]);
    expect(g[0].nombre).toBe('ADEUDO RECIBO AQUALIA');
    expect(g[0].tipo).toBe('contraparte');
  });

  it('el renglón pequeño dice cuándo · dos cargos de la misma luz dan un rango de fechas', () => {
    const g = agruparPorEntidad([
      linea(1, { veredicto: 'cuadra', textoBanco: 'Gas', fecha: '2026-08-03' }),
      linea(2, { veredicto: 'cuadra', textoBanco: 'Gas', fecha: '2026-08-17' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].nombre).toBe('Gas');
    expect(g[0].sub).toBe('03/08/26 a 17/08/26');
  });

  it('una sola línea del mismo día no inventa un rango', () => {
    const g = agruparPorEntidad([linea(1, { veredicto: 'cuadra', fecha: '2026-08-03' })]);
    expect(g[0].sub).toBe('03/08/26');
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

// ── E2.4.2-fix2 · la clasificación del motor llega a la pantalla ─────────────
//
// Jose (11 sep 2026): «el motor ya clasifica, la clasificación está enterrada,
// nadie la lee». Desenterrada: el bucket la mira, la columna derecha agrupa por
// la etiqueta y no por el texto (AHORRO/AHORROS = una fila), y la tarjeta de lo
// que se queda sin clasificar a propósito (el IVA) dice por qué.

const ahorro: ClasificacionLinea = { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', ambito: 'personal', origen: { naturaleza: 'concepto', ambito: 'defecto', familia: 'concepto' }, motivos: ['«ahorro» en el concepto'] };
const soloSigno: ClasificacionLinea = { naturaleza: 'ingreso', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto' }, motivos: [] };

describe('E2.4.2-fix2 · «resuelto = tiene sus 4 ejes puestos»', () => {
  it('una línea clasificada por el motor va a «resueltas»', () => {
    expect(bucketDeLinea(linea(1), decisionesVacias(), new Set(), new Set(), new Set(), new Set([101]))).toBe('resueltas');
  });
  it('una que solo tiene el signo sigue en «te necesitan»', () => {
    expect(bucketDeLinea(linea(1), decisionesVacias(), new Set(), new Set(), new Set(), new Set())).toBe('te_necesitan');
  });
  it('«No es esto» la devuelve a «te necesitan» · e ignorar manda sobre todo', () => {
    const d = decisionesVacias();
    d.desemparejados.add(101);
    expect(bucketDeLinea(linea(1), d, new Set(), new Set(), new Set(), new Set([101]))).toBe('te_necesitan');
    const i = decisionesVacias();
    i.ignorados.add(101);
    expect(bucketDeLinea(linea(1), i, new Set(), new Set(), new Set(), new Set([101]))).toBe('ignorados');
  });
  it('el cuadre las cuenta en «resueltas» y sigue cuadrando', () => {
    const lineas = [linea(1), linea(2), linea(3)];
    const c = cuadre(lineas, decisionesVacias(), new Set(), new Set(), new Set(), new Set([101, 102]));
    expect(c.cuadra).toBe(true);
    expect(c.porBucket.resueltas).toBe(2);
    expect(c.porBucket.te_necesitan).toBe(1);
  });
});

describe('E2.4.2-fix2 · los internos son UNA entidad, no montones por texto', () => {
  it('«AHORRO» y «AHORROS JUNIO» son UNA entidad · «Ahorro · lo que apartas»', () => {
    const g = agruparPorEntidad([
      linea(1, { textoBanco: 'AHORROS', importe: -800, clasificacion: ahorro }),
      linea(2, { textoBanco: 'AHORRO', importe: -1400, clasificacion: ahorro }),
      linea(3, { textoBanco: 'AHORROS JUNIO', importe: -79, clasificacion: ahorro }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].nombre).toBe('Ahorro · lo que apartas');
    expect(g[0].interno).toBe(true);
    expect(g[0].cuantas).toBe(3);
    expect(g[0].total).toBeCloseTo(-2279, 2);
  });
  it('un interno que además casó con un previsto sigue en la entidad interna · y la línea se llama como el previsto', () => {
    const l = linea(1, { veredicto: 'cuadra', textoBanco: 'AHORROS', clasificacion: ahorro, previsto: { id: 7, descripcion: 'Ahorro mensual', importe: -800, fecha: '2025-06-01' } });
    const g = agruparPorEntidad([l, linea(2, { textoBanco: 'AHORRO', clasificacion: ahorro })]);
    expect(g).toHaveLength(1);
    expect(g[0].clave).toBe('interno:a_ahorro');
  });
  it('sin clasificación que valga, la contraparte del banco · como siempre', () => {
    const g = agruparPorEntidad([linea(1, { textoBanco: 'UNIHOUSER S.L.', clasificacion: soloSigno })]);
    expect(g[0].nombre).toBe('UNIHOUSER S.L.');
    expect(g[0].destino).toBe('sin clasificar');
  });
});

describe('E2.4.2-fix2 · la tarjeta de lo que se queda sin clasificar dice por qué', () => {
  it('el IVA · «movimiento con Hacienda»', () => {
    const iva: ClasificacionLinea = { ...soloSigno, naturaleza: 'gasto', motivos: ['movimiento con Hacienda · IVA (modelo 303) · dinero de paso, no un gasto · se decide en la fase de autónomo'] };
    const p = propuestasDeLineas([{ lineaId: 1, clasificacion: iva }], new Map([[1, []]]), undefined, []).get(1)!;
    expect(p.tono).toBe('pregunta');
    expect(p.titular).toMatch(/dímelo tú/);
    expect(p.ayuda).toMatch(/Hacienda.*IVA/);
  });
  it('sin aviso, la frase de siempre', () => {
    const p = propuestasDeLineas([{ lineaId: 1, clasificacion: soloSigno }], new Map([[1, []]]), undefined, []).get(1)!;
    expect(p.ayuda).toMatch(/subes la factura/);
  });
});
