// ============================================================================
// Con lo que la tarjeta enseña, ¿qué se supone que hay que puntear?
// ============================================================================
//
// Tres tarjetas seguidas, idénticas:
//
//   Parece la renta de un inquilino
//   Transferencia recibida        +200,00 €     lunes · 3 ago 2026
//   Parece la renta de un inquilino
//   Transferencia recibida         +83,37 €     miércoles · 8 jul 2026
//   Parece la renta de un inquilino
//   Transferencia recibida        +200,00 €
//
// No hay nada que decidir ahí. Ni quién envió el dinero, ni por qué concepto,
// ni de qué inquilino sería esa renta. Y 83,37 € no es la renta de nadie.
//
// Lo grave es que el dato SÍ ESTÁ. El importador guarda `reference` y
// `counterparty` desde #1831/#1832 —volcado del parser real sobre el fixture:
//
//   description: "Transferencia recibida"   reference: "Enviado por Banco Santander"
//   description: "Cargo por amortizacion…"  reference: "0182-5322-27-0830842450"
//   description: "Retirada de efectivo…"    reference: "TELF: *****2972 - DISPENSA…"
//
// — y `construirLineas` hacía `textoBanco: m.description` y tiraba el resto. El
// número del préstamo que costó dos PR rescatar hasta la base de datos no
// llegaba nunca a la pantalla.
//
// Y la propuesta afirmaba lo que no sabe. «Parece la renta de un inquilino»
// sobre un ingreso sin nombre reconocido no es una deducción: es un adorno
// sobre `assign_to_contract` con `contractId: undefined`, que además es una
// acción IMPOSIBLE de ejecutar — el bug que arregló `asignarCobroAContrato`.
// ============================================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { construirLineas as construirLineasReal } from '../extractoSesion';
import type { Movement, LineaExtractoPersistida } from '../../../../services/db';
import type { MatchResult } from '../../../../services/movementMatchingService';
import { generateLineHash } from '../../../../services/statementIgnoredLinesService';

const movimiento = (over: Partial<Movement> & { id: number }): Movement =>
  ({
    accountId: 1,
    date: '2026-08-03',
    amount: 200,
    description: 'Transferencia recibida',
    unifiedStatus: 'sin_planificar',
    ...over,
  }) as Movement;

// E1.5 · la sesión se construye desde las FILAS de `lineasExtracto`. Estos
// tests describen la línea como un movimiento; el puente la convierte en la
// fila que el import habría guardado (lineaId = 100 + id) y traduce el
// emparejamiento a `lineaId`.
const L = (movementId: number) => 100 + movementId;
const filaDe = (m: Movement): LineaExtractoPersistida => ({
  id: L(m.id as number),
  fechaOperacion: m.date,
  fechaValor: m.valueDate ?? m.date,
  importe: m.amount,
  conceptoLiteral: m.description,
  ...(m.counterparty != null ? { contraparte: m.counterparty } : {}),
  ...(m.reference != null ? { referencia: m.reference } : {}),
  importBatchId: 'lote',
  accountId: m.accountId,
  hashLinea: generateLineHash({ date: m.date, amount: m.amount, description: m.description }),
  hashMovement: '',
  estado: 'pendiente',
  movementIds: [],
  createdAt: '',
  updatedAt: '',
});
const construirLineas = (
  movs: Movement[],
  mr: MatchResult,
  evs: Parameters<typeof construirLineasReal>[2],
  ign: Set<string>,
  conf: Map<number, { id: number; descripcion: string; importe: number; fecha: string }> = new Map(),
) =>
  construirLineasReal(
    movs.map(filaDe),
    {
      matches: (mr.matches ?? []).map(({ movementId, ...c }) => ({ lineaId: L(movementId), ...c })),
      multiMatches: (mr.multiMatches ?? []).map((mm) => ({
        lineaId: L(mm.movementId),
        candidates: mm.candidates.map(({ movementId, ...c }) => ({ lineaId: L(movementId), ...c })),
      })),
      sinMatch: (mr.sinMatch ?? []).map(L),
    },
    evs,
    ign,
    new Map(Array.from(conf, ([movementId, ref]) => [L(movementId), ref])),
  );

const SIN_MATCHES: MatchResult = {
  matches: [],
  multiMatches: [],
  unmatched: [],
} as unknown as MatchResult;

describe('lo que el banco escribió llega entero a la línea', () => {
  it('la referencia del movimiento viaja hasta la pantalla', () => {
    // «Transferencia recibida» a secas no dice nada; «Enviado por Banco
    // Santander» empieza a decir algo. Está guardado desde el importador.
    const [linea] = construirLineas(
      [movimiento({ id: 1, reference: 'Enviado por Banco Santander' })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    expect(linea.referencia).toBe('Enviado por Banco Santander');
  });

  it('y la contraparte también · quién pagó o cobró', () => {
    const [linea] = construirLineas(
      [movimiento({ id: 1, counterparty: 'AROA GOMEZ FERNANDEZ' })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    expect(linea.contraparte).toBe('AROA GOMEZ FERNANDEZ');
  });

  it('el número del préstamo, que costó dos PR rescatar, llega a la línea', () => {
    const [linea] = construirLineas(
      [
        movimiento({
          id: 1,
          amount: -285.4,
          description: 'Cargo por amortizacion de prestamo/credito',
          reference: '0182-5322-27-0830842450',
        }),
      ],
      SIN_MATCHES,
      [],
      new Set(),
    );

    expect(linea.referencia).toContain('0182-5322-27-0830842450');
  });

  it('sin referencia no se inventa un hueco · el campo simplemente no está', () => {
    const [linea] = construirLineas([movimiento({ id: 1 })], SIN_MATCHES, [], new Set());
    expect(linea.referencia).toBeUndefined();
    expect(linea.contraparte).toBeUndefined();
  });

  it('el texto del banco NO se toca · el hash de la línea depende de él', () => {
    // Reescribir `description` para meterle la referencia dentro rompería el
    // dedupe entre importaciones solapadas y duplicaría cargos reales. Por eso
    // la referencia va en un campo aparte, no concatenada.
    const [linea] = construirLineas(
      [movimiento({ id: 1, reference: 'Enviado por Banco Santander' })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    expect(linea.textoBanco).toBe('Transferencia recibida');
  });
});

describe('la línea enseña lo que sabe', () => {
  it('debajo del texto del banco aparece la referencia', async () => {
    const LineaExtractoItem = (await import('../LineaExtractoItem')).default;
    const { decisionesVacias } = await import('../extractoSesion');
    const [linea] = construirLineas(
      [movimiento({ id: 1, reference: 'Enviado por Banco Santander' })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    render(
      <LineaExtractoItem
        linea={linea}
        decisiones={decisionesVacias()}
        previstos={[]}
        cuentas={[]}
        asignando={null}
        setAsignando={() => undefined}
        traspasando={null}
        setTraspasando={() => undefined}
        asignar={() => undefined}
        ignorar={() => undefined}
        marcarEfectivo={() => undefined}
        desmarcarEfectivo={() => undefined}
        marcarTraspaso={() => undefined}
        desmarcarTraspaso={() => undefined}
        igualesSinResolver={0}
        abrirCrear={() => undefined}
        nombrarPrevisto={() => ''}
        nombrarPrevistoPorId={(_id, d) => d}
        sinCaja
      />,
    );

    expect(screen.getByText('Transferencia recibida')).toBeInTheDocument();
    expect(screen.getByText(/Enviado por Banco Santander/)).toBeInTheDocument();
  });
});

// ─── Cuántos previstos cuadran, dicho en el botón ───────────────────────────

describe('el botón dice si hay algo que de verdad cuadra', () => {
  const pintarLinea = async (linea: unknown, previstos: unknown[]) => {
    const LineaExtractoItem = (await import('../LineaExtractoItem')).default;
    const { decisionesVacias } = await import('../extractoSesion');
    return render(
      <LineaExtractoItem
        linea={linea as never}
        decisiones={decisionesVacias()}
        previstos={previstos as never}
        cuentas={[]}
        asignando={null}
        setAsignando={() => undefined}
        traspasando={null}
        setTraspasando={() => undefined}
        asignar={() => undefined}
        ignorar={() => undefined}
        marcarEfectivo={() => undefined}
        desmarcarEfectivo={() => undefined}
        marcarTraspaso={() => undefined}
        desmarcarTraspaso={() => undefined}
        igualesSinResolver={0}
        abrirCrear={() => undefined}
        nombrarPrevisto={() => ''}
        nombrarPrevistoPorId={(_id: number, d: string) => d}
        sinCaja
      />,
    );
  };

  const previsto = (id: number, amount: number, predictedDate: string) => ({
    id,
    accountId: 1,
    type: 'income',
    amount,
    predictedDate,
    description: `Renta piso ${id}`,
    status: 'predicted',
  });

  it('con dos previstos del mismo importe lo dice · «2 cuadran»', async () => {
    // Hoy el botón pone «Asignar a un previsto» y punto: hay que pulsarlo para
    // enterarse de si detrás hay algo o no. Que dos rentas de 200 € cuadren
    // exactas con este ingreso es JUSTO lo que hace falta saber antes.
    const [linea] = construirLineas(
      [movimiento({ id: 1, amount: 200 })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    await pintarLinea(linea, [previsto(9, 200, '2026-08-01'), previsto(10, 200, '2026-08-05')]);

    expect(screen.getByRole('button', { name: /asignar a un previsto · 2 cuadran/i })).toBeInTheDocument();
  });

  it('si ninguno cuadra de importe no promete que cuadre', async () => {
    const [linea] = construirLineas(
      [movimiento({ id: 1, amount: 83.37 })],
      SIN_MATCHES,
      [],
      new Set(),
    );

    await pintarLinea(linea, [previsto(9, 200, '2026-08-01')]);

    const boton = screen.getByRole('button', { name: /asignar a un previsto/i });
    expect(boton.textContent).not.toMatch(/cuadran|cuadra de importe/i);
  });
});

// ─── La propuesta no puede afirmar lo que no sabe ───────────────────────────

describe('«parece la renta de un inquilino» exige un inquilino', () => {
  it('sin contrato reconocido no se propone asignar a un contrato', async () => {
    // `assign_to_contract` sin `contractId` es además una acción IMPOSIBLE de
    // ejecutar: el evento nacería sin `sourceId` ni `contratoId`, huérfano, ni
    // contando para el estado de cobro del inquilino ni para el dedupe de
    // previsiones. Es el bug que arregló `asignarCobroAContrato`, propuesto
    // desde la pantalla con una frase bonita encima.
    jest.resetModules();
    jest.doMock('../../../../services/db', () => ({ initDB: jest.fn() }));
    jest.doMock('../../../../services/movementLearningService', () => ({
      ...jest.requireActual('../../../../services/movementLearningService'),
      buildLearnKey: () => 'hash:sin-regla',
    }));
    const { suggestForUnmatched } = await import('../../../../services/movementSuggestionService');
    const { initDB } = await import('../../../../services/db');

    const mov = movimiento({ id: 1, amount: 200, description: 'Transferencia recibida' });
    (initDB as jest.Mock).mockResolvedValue({
      get: async () => mov,
      getAll: async () => [],
      getAllFromIndex: async () => [],
    });

    const sugerencias = (await suggestForUnmatched([1])).get(1) ?? [];

    expect(sugerencias.some((s) => s.action.kind === 'assign_to_contract')).toBe(false);
    // Y la línea sigue teniendo algo que decir: la pregunta abierta, que es la
    // verdad, en vez de una afirmación que invita a un clic equivocado.
    expect(sugerencias.length).toBeGreaterThan(0);
  });

  it('con el contrato reconocido SÍ se propone · y con su nombre dentro', async () => {
    jest.resetModules();
    jest.doMock('../../../../services/db', () => ({ initDB: jest.fn() }));
    jest.doMock('../../../../services/movementLearningService', () => ({
      ...jest.requireActual('../../../../services/movementLearningService'),
      buildLearnKey: () => 'hash:sin-regla',
    }));
    const { suggestForUnmatched } = await import('../../../../services/movementSuggestionService');
    const { initDB } = await import('../../../../services/db');

    const mov = movimiento({ id: 1, amount: 500, description: 'BIZUM DE AROA GOMEZ' });
    const contrato = {
      id: 3,
      estadoContrato: 'activo',
      inquilino: { nombre: 'Aroa', apellidos: 'Gómez' },
    };
    (initDB as jest.Mock).mockResolvedValue({
      get: async () => mov,
      getAll: async (store: string) => (store === 'contracts' ? [contrato] : []),
      getAllFromIndex: async () => [],
    });

    const sugerencias = (await suggestForUnmatched([1])).get(1) ?? [];
    const asignar = sugerencias.find((s) => s.action.kind === 'assign_to_contract');

    expect(asignar).toBeDefined();
    expect(asignar!.action).toMatchObject({ kind: 'assign_to_contract', contractId: 3 });
    expect(asignar!.description).toContain('Aroa');
  });
});
