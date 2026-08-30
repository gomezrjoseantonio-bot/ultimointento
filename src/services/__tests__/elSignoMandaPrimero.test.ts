// ============================================================================
// EL SIGNO MANDA PRIMERO · un negativo nunca es una renta, un positivo nunca es un gasto
// ============================================================================
//
// El bug, con las líneas reales del extracto de Jose:
//
//   Compra Bizum Iryo                       −70,48 €  →  "Parece la renta de un inquilino"
//   Bizum A Favor De Luis Eduardo Montes    −15,00 €  →  "Parece la renta de un inquilino"
//   Bizum A Favor De Aroa Gómez             −80,00 €  →  "Parece la renta de un inquilino"
//
// Las tres son dinero que SALE de la cuenta. Una renta se COBRA. Y "Bizum A
// FAVOR DE Aroa" además dice literalmente en el texto del banco quién recibe el
// dinero: Aroa. Proponerlo como cobro de renta no es una imprecisión, es lo
// contrario de lo que pasó.
//
// La causa está en `movementSuggestionService.ts`: la regla del Bizum recibe el
// importe en el segundo argumento del `match` y no lo mira. Y no era la única —
// de las seis heurísticas sólo la de Amazon comprobaba el signo.
//
// La regla dura que fija esta batería, y que vale para TODO el detector, no sólo
// para el Bizum:
//
//   importe > 0  ⇒  dinero que ENTRA  ⇒  candidato a ingreso / renta, nunca a gasto
//   importe < 0  ⇒  dinero que SALE   ⇒  candidato a gasto,          nunca a renta
//
// Por eso el barrido de más abajo no prueba reglas una a una: coge las
// descripciones reales que disparan cada vía, las pasa por el detector REAL en
// positivo y en negativo, y exige el invariante sobre lo que salga. Una regla
// nueva que se olvide del signo — dentro de un año, escrita por otro — se pone
// roja aquí sola, sin que nadie se acuerde de venir a añadirle un caso.
// ============================================================================

import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { Contract, Movement } from '../db';
import { suggestForUnmatched } from '../movementSuggestionService';
import type { MovementSuggestion, SuggestionAction } from '../movementSuggestionService';

jest.mock('../cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

// ─── El invariante, escrito aparte del código que lo tiene que cumplir ───────
//
// Deliberadamente NO se importa el clasificador de producción: si el test usara
// el mismo, un error en él pasaría inadvertido en los dos sitios a la vez. Esto
// es la especificación; lo otro es la implementación.

type Direccion = 'entra' | 'sale' | 'ninguna';

function direccionQueImplicaLaPropuesta(action: SuggestionAction): Direccion {
  switch (action.kind) {
    // Asignar a un contrato es dar por cobrada una renta.
    case 'assign_to_contract':
      return 'entra';
    case 'mark_personal_expense':
      return 'sale';
    case 'create_treasury_event':
      if (action.type === 'income') return 'entra';
      if (action.type === 'expense') return 'sale';
      return 'ninguna';
    case 'ignore':
    default:
      return 'ninguna';
  }
}

function direccionDelDinero(amount: number): Direccion {
  if (amount > 0) return 'entra';
  if (amount < 0) return 'sale';
  return 'ninguna';
}

function loQueContradiceElSigno(
  sugerencias: MovementSuggestion[],
  amount: number,
): MovementSuggestion[] {
  const dinero = direccionDelDinero(amount);
  if (dinero === 'ninguna') return [];
  return sugerencias.filter((s) => {
    const propuesta = direccionQueImplicaLaPropuesta(s.action);
    return propuesta !== 'ninguna' && propuesta !== dinero;
  });
}

// ─── Utillería de datos reales ──────────────────────────────────────────────

const CUENTA = 1;

const limpiar = async (): Promise<void> => {
  const db = await initDB();
  for (const store of [
    'treasuryEvents',
    'contracts',
    'accounts',
    'movements',
    'movementLearningRules',
    'compromisosRecurrentes',
  ] as const) {
    await db.clear(store);
  }
  await db.add('accounts', {
    id: CUENTA,
    name: 'Cuenta principal',
    iban: 'ES0000000000000000000001',
    balance: 0,
  } as never);
};

const contratoDe = (nombre: string, apellidos: string): Omit<Contract, 'id'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: { nombre, apellidos, dni: 'X1234567L', telefono: '', email: '' },
    fechaInicio: '2020-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 500,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 500,
    fianzaEstado: 'retenida',
    cuentaCobroId: CUENTA,
    estadoContrato: 'activo',
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Contract, 'id'>;

/** Mete la línea en la base y devuelve lo que el detector REAL propone sobre ella. */
async function sugerenciasDe(description: string, amount: number): Promise<MovementSuggestion[]> {
  const db = await initDB();
  const id = (await db.add('movements', {
    accountId: CUENTA,
    date: '2026-02-02',
    amount,
    description,
    importBatch: 'lote-signo',
    unifiedStatus: 'sin_planificar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<Movement, 'id'> as never)) as number;
  const mapa = await suggestForUnmatched([id]);
  return mapa.get(id) ?? [];
}

// ─── Las tres líneas de la captura ──────────────────────────────────────────

describe('el signo manda primero · las líneas reales del extracto', () => {
  beforeEach(limpiar);

  it.each([
    ['Compra Bizum Iryo', -70.48],
    ['Bizum A Favor De Luis Eduardo Montes', -15],
    ['Bizum A Favor De Aroa Gómez', -80],
  ])('«%s» %s € sale de la cuenta · jamás se propone como renta', async (descripcion, importe) => {
    const sugerencias = await sugerenciasDe(descripcion as string, importe as number);

    expect(sugerencias.some((s) => s.action.kind === 'assign_to_contract')).toBe(false);
    expect(loQueContradiceElSigno(sugerencias, importe as number)).toEqual([]);
  });

  it('«Bizum A Favor De Aroa Gómez» −80 € no se propone como renta NI existiendo el contrato de Aroa', async () => {
    // El caso feo: el nombre del texto del banco coincide con un inquilino vivo,
    // que es justo lo que hacía saltar la propuesta con 60 de confianza. El
    // nombre coincide porque Aroa es quien COBRA los 80 €, no quien los paga.
    const db = await initDB();
    await db.add('contracts', contratoDe('Aroa', 'Gómez') as never);

    const sugerencias = await sugerenciasDe('Bizum A Favor De Aroa Gómez', -80);

    expect(sugerencias.some((s) => s.action.kind === 'assign_to_contract')).toBe(false);
  });

  it('el mismo Bizum en positivo SÍ se propone como renta · no se ha roto lo que funcionaba', async () => {
    const db = await initDB();
    await db.add('contracts', contratoDe('Aroa', 'Gómez') as never);

    const sugerencias = await sugerenciasDe('Bizum De Aroa Gómez', 500);

    expect(sugerencias.some((s) => s.action.kind === 'assign_to_contract')).toBe(true);
    expect(loQueContradiceElSigno(sugerencias, 500)).toEqual([]);
  });
});

// ─── La otra mitad de la regla · ningún gasto sobre un importe positivo ─────

describe('el signo manda primero · un positivo no es un gasto', () => {
  beforeEach(limpiar);

  it.each([
    ['RECIBO IBERDROLA CLIENTES SAU', 89.4],
    ['CUOTA PRESTAMO 0182-5322-27-0830842450', 285.4],
    ['RECIBO IBI AYUNTAMIENTO DE OVIEDO', 312.55],
    ['COMUNIDAD DE PROPIETARIOS ROSAL 15', 45],
    ['COMPRA AMAZON EU SARL', 24.99],
  ])('«%s» +%s € entra en la cuenta · no se propone como gasto', async (descripcion, importe) => {
    const sugerencias = await sugerenciasDe(descripcion as string, importe as number);

    expect(loQueContradiceElSigno(sugerencias, importe as number)).toEqual([]);
  });

  it.each([
    ['RECIBO IBERDROLA CLIENTES SAU', -89.4],
    ['CUOTA PRESTAMO 0182-5322-27-0830842450', -285.4],
    ['RECIBO IBI AYUNTAMIENTO DE OVIEDO', -312.55],
    ['COMUNIDAD DE PROPIETARIOS ROSAL 15', -45],
  ])('«%s» %s € sí sigue proponiéndose como gasto', async (descripcion, importe) => {
    const sugerencias = await sugerenciasDe(descripcion as string, importe as number);

    const gasto = sugerencias.find(
      (s) => s.action.kind === 'create_treasury_event' && s.action.type === 'expense',
    );
    expect(gasto).toBeDefined();
  });
});

// ─── El barrido · el invariante sobre todo lo que el detector sabe decir ────

describe('el signo manda primero · invariante sobre TODO el detector', () => {
  beforeEach(limpiar);

  const DESCRIPCIONES = [
    'Compra Bizum Iryo',
    'Bizum A Favor De Luis Eduardo Montes',
    'BIZUM DE ADNAN PARWEZ',
    'TRANSFERENCIA RECIBIDA DE FUENTES',
    'RECIBO IBERDROLA CLIENTES SAU',
    'RECIBO MOVISTAR FIBRA',
    'CUOTA PRESTAMO 0182-5322-27-0830842450',
    'HIPOTECA VIVIENDA HABITUAL',
    'RECIBO IBI AYUNTAMIENTO DE OVIEDO',
    'TASA BASURA 2026',
    'COMUNIDAD DE PROPIETARIOS ROSAL 15',
    'ADMIN FINCAS DEL NORTE',
    'COMPRA AMAZON EU SARL',
    'PAGO EN ESTACION DE SERVICIO',
  ];

  it.each(DESCRIPCIONES)(
    '«%s» · ninguna propuesta contradice el signo, ni en positivo ni en negativo',
    async (descripcion) => {
      const db = await initDB();
      // Con un contrato vivo cuyo nombre puede sonar a cualquiera de las líneas:
      // así el barrido cubre también la rama que resuelve contraparte.
      await db.add('contracts', contratoDe('Adnan', 'Parwez') as never);

      for (const importe of [123.45, -123.45]) {
        const sugerencias = await sugerenciasDe(descripcion, importe);
        expect({
          descripcion,
          importe,
          contradicen: loQueContradiceElSigno(sugerencias, importe).map((s) => ({
            via: s.via,
            action: s.action,
          })),
        }).toEqual({ descripcion, importe, contradicen: [] });
      }
    },
  );

  it('toda línea sigue teniendo algo que decir · descartar por signo no deja la tarjeta vacía', async () => {
    // Si el guardián se limitara a tirar la propuesta, la línea se quedaría sin
    // nada y la pantalla enseñaría el churro del banco pelado — que es el bug
    // que la pantalla de conciliar vino a matar.
    const sugerencias = await sugerenciasDe('Bizum A Favor De Luis Eduardo Montes', -15);
    expect(sugerencias.length).toBeGreaterThan(0);
  });
});

// ─── Vía B · una regla aprendida tampoco puede saltarse el signo ────────────

describe('el signo manda primero · vía B (reglas aprendidas)', () => {
  beforeEach(limpiar);

  it('una regla PERSONAL no marca gasto sobre un ingreso', async () => {
    // Cómo se llega aquí: el usuario clasificó una vez "NOMINA ORANGE" como
    // gasto personal por error, o la regla nació de una devolución. La clave de
    // aprendizaje lleva el signo dentro, sí — pero la acción se construía sin
    // mirarlo, y `amountSign` puede quedar desalineado en reglas viejas creadas
    // por el orquestador como placeholder (`amountSign: 'positive'` por defecto).
    const db = await initDB();
    const mov = {
      accountId: CUENTA,
      date: '2026-02-02',
      amount: 1840.22,
      description: 'ABONO NOMINA ORANGE ESPAGNE SA',
      importBatch: 'lote-signo',
      unifiedStatus: 'sin_planificar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<Movement, 'id'>;
    const id = (await db.add('movements', mov as never)) as number;

    const { buildLearnKey } = await import('../movementLearningService');
    await db.add('movementLearningRules', {
      learnKey: buildLearnKey({ ...mov, id } as Movement),
      counterpartyPattern: 'orange',
      descriptionPattern: 'abono nomina orange',
      amountSign: 'negative',
      categoria: 'suministros',
      ambito: 'PERSONAL',
      source: 'IMPLICIT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      appliedCount: 4,
    } as never);

    const sugerencias = (await suggestForUnmatched([id])).get(id) ?? [];

    expect(sugerencias.some((s) => s.action.kind === 'mark_personal_expense')).toBe(false);
    expect(loQueContradiceElSigno(sugerencias, 1840.22)).toEqual([]);
  });
});
