// E2.4 · reconocer contra la DEFINICIÓN, no contra la previsión · los reconocedores puros.
//
// Todo lo que se reconoce aquí se cierra SIN preguntar, así que cada fuente
// lleva su caso de que SÍ cuadra y sus casos de que NO debe cuadrar (§4 ·
// dinero). Ninguno de estos tests toca `treasuryEvents`: ese es el punto.

import type { Movement } from '../../db';
import type { Account, Contract } from '../../db/types-contratos';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Prestamo } from '../../../types/prestamos';
import { recurrentesQueCuadran, cierraSola } from '../recurrentes';
import { rentasQueCuadran, rentaVigenteEn, vigenteEn } from '../rentas';
import {
  traspasosPropios,
  nombresDelTitular,
  parteDeLaTransferencia,
  laParteEsElTitular,
  espejoDe,
} from '../traspasosPropios';
import { nominasQueSeReconocen } from '../nominas';
import { cuotasQueCuadran, llevaElContrato, MARGEN_DIAS_CUOTA } from '../cuotasDePrestamo';
import { esPorDefinicion, FUENTES_POR_DEFINICION } from '../tipos';
import { normalizarTexto } from '../texto';

const CUENTA = 1;
const OTRA = 2;

const mov = (over: Partial<Movement> & { id: number }): Movement =>
  ({
    accountId: CUENTA,
    date: '2025-03-02',
    amount: -24.9,
    description: '',
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    source: 'import',
    category: { tipo: 'Gastos' },
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Confirmado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Movement;

// ─── recurrentes ────────────────────────────────────────────────────────────

const compromiso = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 11,
    alias: 'Seguro decesos',
    ambito: 'personal',
    tipo: 'seguro',
    proveedor: { nombre: 'Segurcaixa Adeslas' },
    numeroContrato: '07085234611',
    patron: { tipo: 'mensualDiaFijo', dia: 2 },
    importe: { modo: 'fijo', importe: 24.9 },
    cuentaCargo: CUENTA,
    conceptoBancario: 'SEGURCAIXA ADESLAS',
    metodoPago: 'domiciliacion',
    categoria: 'seguros',
    estado: 'activo',
    ...over,
  }) as unknown as CompromisoRecurrente;

describe('E2.4 · recurrentes contra su definición · sin previsión', () => {
  it('el seguro de decesos de HACE UN AÑO se reconoce por su nº de mandato · no hay previsión y no hace falta', () => {
    const r = recurrentesQueCuadran(
      [mov({ id: 1, date: '2025-03-03', description: 'Recibo Segurcaixa Adeslas Mandato 07085234611' })],
      [compromiso()],
    );
    expect(r).toEqual([
      {
        movementId: 1,
        fuente: 'recurrente',
        origenId: '11',
        titulo: 'Seguro decesos · Segurcaixa Adeslas',
        como: 'identidad',
        categoryKey: 'seguros',
      },
    ]);
  });

  it('las 21 mensualidades del histórico se reconocen las 21, no una', () => {
    const lineas: Movement[] = [];
    for (let i = 0; i < 21; i++) {
      const mes = 1 + (i % 12);
      const año = 2024 + Math.floor(i / 12);
      lineas.push(
        mov({
          id: 100 + i,
          date: `${año}-${String(mes).padStart(2, '0')}-02`,
          description: 'Recibo Segurcaixa Adeslas Mandato 07085234611',
        }),
      );
    }
    expect(recurrentesQueCuadran(lineas, [compromiso()])).toHaveLength(21);
  });

  it('con identidad, un FIJO con OTRO importe no se cierra solo · algo cambió y la vía A lo propone', () => {
    const r = recurrentesQueCuadran(
      [mov({ id: 1, amount: -31.5, description: 'Recibo Segurcaixa Adeslas Mandato 07085234611' })],
      [compromiso()],
    );
    expect(r).toEqual([]);
  });

  it('sin identificador: texto + importe EXACTO de un fijo cierra · el renting de 351,13 los 12 meses', () => {
    const ayvens = compromiso({
      id: 12,
      alias: 'Renting coche',
      proveedor: { nombre: 'Ayvens' },
      numeroContrato: undefined,
      conceptoBancario: 'AYVENS',
      patron: { tipo: 'mensualDiaFijo', dia: 8 },
      importe: { modo: 'fijo', importe: 351.13 },
    });
    const r = recurrentesQueCuadran(
      [mov({ id: 1, date: '2025-05-08', amount: -351.13, description: 'Recibo Ayvens Espana Sau Renting' })],
      [ayvens],
    );
    expect(r[0]).toMatchObject({ fuente: 'recurrente', origenId: '12', como: 'definicion' });
  });

  it('sin identificador y sin importe plausible → NO se reconoce (a «te necesitan»)', () => {
    const ayvens = compromiso({
      id: 12,
      alias: 'Renting coche',
      proveedor: { nombre: 'Ayvens' },
      numeroContrato: undefined,
      conceptoBancario: 'AYVENS',
      importe: { modo: 'fijo', importe: 351.13 },
    });
    expect(
      recurrentesQueCuadran([mov({ id: 1, amount: -120, description: 'Recibo Ayvens Espana Sau Renting' })], [ayvens]),
    ).toEqual([]);
  });

  it('un VARIABLE (agua) cierra solo si es plausible Y cae en el día del patrón', () => {
    const agua = compromiso({
      id: 13,
      alias: 'Agua Tenderina',
      ambito: 'inmueble',
      inmuebleId: 4,
      proveedor: { nombre: 'Canal de Isabel II' },
      numeroContrato: undefined,
      conceptoBancario: 'CANAL DE ISABEL II',
      patron: { tipo: 'bimestral', dia: 15, mesInicio: 2 } as unknown as CompromisoRecurrente['patron'],
      importe: { modo: 'variable', importeMedio: 40 } as unknown as CompromisoRecurrente['importe'],
      categoria: 'suministros',
    });
    // Puede que el patrón bimestral no proyecte · entonces el calendario es
    // neutro y un variable NO cierra solo. Lo que se afirma es lo negativo.
    const fuera = recurrentesQueCuadran(
      [mov({ id: 2, date: '2025-05-20', amount: -38.2, description: 'Recibo Canal De Isabel II Agua' })],
      [agua],
    );
    for (const o of fuera) expect(o.como).toBe('definicion');
    expect(
      cierraSola({
        compromiso: agua,
        confianza: 80,
        porTexto: true,
        importe: 'plausible',
        calendario: 'neutro',
        razones: [],
      }),
    ).toBe(false);
    expect(
      cierraSola({
        compromiso: agua,
        confianza: 85,
        porTexto: true,
        importe: 'plausible',
        calendario: 'cuadra',
        razones: [],
      }),
    ).toBe(true);
  });

  it('el CUPS de OTRO piso no casa este recibo · el identificador manda', () => {
    const luzA = compromiso({ id: 21, alias: 'Luz A', cups: 'ES0021000012345678MD', numeroContrato: undefined, proveedor: { nombre: 'Iberdrola' }, conceptoBancario: 'IBERDROLA', importe: { modo: 'variable', importeMedio: 60 } as never, inmuebleId: 4, ambito: 'inmueble', categoria: 'suministros' });
    const r = recurrentesQueCuadran(
      [mov({ id: 1, amount: -58, description: 'Recibo Iberdrola Clientes CUPS ES0021000098765432ZZ' })],
      [luzA],
    );
    expect(r).toEqual([]);
  });

  it('un gasto de INMUEBLE cuya categoría no tiene casilla NO se cierra solo', () => {
    const sinCasilla = compromiso({ id: 31, ambito: 'inmueble', inmuebleId: 4, categoria: 'categoria-inventada-sin-casilla' });
    expect(
      recurrentesQueCuadran([mov({ id: 1, description: 'Recibo Segurcaixa Adeslas Mandato 07085234611' })], [sinCasilla]),
    ).toEqual([]);
    // El mismo compromiso en PERSONAL sí: no hay fila fiscal que escribir.
    const personal = compromiso({ id: 32, categoria: 'categoria-inventada-sin-casilla' });
    expect(
      recurrentesQueCuadran([mov({ id: 1, description: 'Recibo Segurcaixa Adeslas Mandato 07085234611' })], [personal]),
    ).toHaveLength(1);
  });

  it('un abono nunca es un recurrente', () => {
    expect(
      recurrentesQueCuadran([mov({ id: 1, amount: 24.9, description: 'Devolucion Segurcaixa Mandato 07085234611' })], [compromiso()]),
    ).toEqual([]);
  });
});

// ─── rentas ─────────────────────────────────────────────────────────────────

const contrato = (over: Partial<Contract> = {}): Contract =>
  ({
    id: 21,
    inmuebleId: 4,
    unidadTipo: 'vivienda',
    inquilino: { nombre: 'Miguel', apellidos: 'Lorenzo Cabanelas' },
    fechaInicio: '2024-02-01',
    fechaFin: '2029-01-31',
    rentaMensual: 650,
    diaPago: 5,
    margenGraciaDias: 5,
    cuentaCobroId: CUENTA,
    estadoContrato: 'activo',
    ...over,
  }) as unknown as Contract;

describe('E2.4 · renta contra el CONTRATO · sin previsión', () => {
  it('la renta de hace 14 meses se reconoce por inquilino + importe + vigencia', () => {
    const r = rentasQueCuadran(
      [mov({ id: 1, date: '2025-01-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Alquiler Enero' })],
      [contrato()],
    );
    expect(r).toEqual([
      {
        movementId: 1,
        fuente: 'renta',
        origenId: '21',
        titulo: 'Renta · Miguel Lorenzo Cabanelas',
        como: 'identidad',
        inmuebleId: 4,
        categoryKey: 'alquiler',
        renta: { contratoId: 21, inquilino: 'Miguel Lorenzo Cabanelas' },
      },
    ]);
  });

  it('las 18 rentas de Tenderina se reconocen las 18', () => {
    const lineas: Movement[] = [];
    for (let i = 0; i < 18; i++) {
      const mes = 1 + (i % 12);
      const año = 2024 + Math.floor(i / 12);
      if (año === 2024 && mes === 1) continue; // antes del contrato
      lineas.push(mov({ id: 200 + i, date: `${año}-${String(mes).padStart(2, '0')}-05`, amount: 650, description: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Alquiler' }));
    }
    expect(rentasQueCuadran(lineas, [contrato()])).toHaveLength(lineas.length);
  });

  it('el importe es el del tramo del histórico vigente ese mes · la indexación no rompe el pasado', () => {
    const c = contrato({
      rentaMensual: 680,
      historicoRentas: [
        { fechaDesde: '2024-02-01', importe: 650, origen: 'firma_inicial' },
        { fechaDesde: '2025-02-01', importe: 680, origen: 'indexacion' },
      ],
    });
    expect(rentaVigenteEn(c, '2024-11-05')).toBe(650);
    expect(rentaVigenteEn(c, '2025-03-05')).toBe(680);
    expect(rentasQueCuadran([mov({ id: 1, date: '2024-11-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Concepto Alquiler' })], [c])).toHaveLength(1);
    expect(rentasQueCuadran([mov({ id: 2, date: '2025-03-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Concepto Alquiler' })], [c])).toEqual([]);
  });

  it('un importe que no es la renta NO cuadra aunque sea el inquilino (una fianza, un pago parcial)', () => {
    expect(rentasQueCuadran([mov({ id: 1, date: '2025-01-05', amount: 300, description: 'Transferencia De Miguel Lorenzo Cabanelas' })], [contrato()])).toEqual([]);
  });

  it('fuera de la vigencia no cuadra · el contrato no explica un cobro anterior a su firma', () => {
    expect(vigenteEn(contrato(), '2023-12-05')).toBe(false);
    expect(rentasQueCuadran([mov({ id: 1, date: '2023-12-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Cabanelas Alquiler' })], [contrato()])).toEqual([]);
  });

  it('sin nombre: «alquiler» + importe exacto + la cuenta de cobro del contrato · si el texto no dice quién, vale la cuenta', () => {
    const r = rentasQueCuadran([mov({ id: 1, date: '2025-01-05', amount: 650, description: 'Ingreso Alquiler Enero' })], [contrato()]);
    expect(r[0]).toMatchObject({ fuente: 'renta', como: 'definicion' });
    // …pero en OTRA cuenta no: sin nombre y sin cuenta no hay nada que ate.
    expect(rentasQueCuadran([mov({ id: 2, accountId: OTRA, date: '2025-01-05', amount: 650, description: 'Ingreso Alquiler Enero' })], [contrato()])).toEqual([]);
  });

  it('dos contratos con la misma renta y el nombre no distingue → no se elige', () => {
    const a = contrato({ id: 21, inquilino: { nombre: 'Laura', apellidos: 'Sánchez' } as never });
    const b = contrato({ id: 22, inquilino: { nombre: 'Laura', apellidos: 'Ruiz' } as never });
    expect(rentasQueCuadran([mov({ id: 1, date: '2025-01-05', amount: 650, description: 'Transferencia Alquiler Laura' })], [a, b])).toEqual([]);
  });

  it('un contrato sin identificar o sin firmar no explica nada', () => {
    expect(rentasQueCuadran([mov({ id: 1, date: '2025-01-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Cabanelas Alquiler' })], [contrato({ estadoContrato: 'sin_firmar' })])).toEqual([]);
  });

  it('un contrato FINALIZADO sí explica las rentas de cuando estaba vigente', () => {
    const viejo = contrato({ estadoContrato: 'finalizado', fechaFin: '2025-06-30' });
    expect(rentasQueCuadran([mov({ id: 1, date: '2025-03-05', amount: 650, description: 'Transferencia De Miguel Lorenzo Cabanelas Alquiler' })], [viejo])).toHaveLength(1);
  });
});

// ─── traspasos propios ──────────────────────────────────────────────────────

const cuenta = (over: Partial<Account> = {}): Account =>
  ({
    id: CUENTA,
    iban: 'ES9121000418450200051332',
    alias: 'Santander',
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Account;

const CUENTAS = [cuenta(), cuenta({ id: OTRA, iban: 'ES7921000813610123456789', alias: 'Bankinter' }), cuenta({ id: 3, iban: 'ES1000492352082414205416', alias: 'Revolut' })];
const YO = [{ nombre: 'José Antonio', apellidos: 'Gómez Ramírez' }];

describe('E2.4 · traspasos PROPIOS · el otro lado es el titular', () => {
  const nombres = nombresDelTitular(YO, CUENTAS);

  it('«Transferencia De Gomez Ramirez Jose Antonio» → entrada de un traspaso · sin cuenta conocida, sin par', () => {
    const r = traspasosPropios([mov({ id: 1, amount: 1500, description: 'Transferencia De Gomez Ramirez Jose Antonio Concepto Traspaso' })], CUENTAS, nombres);
    expect(r).toEqual([
      { movementId: 1, fuente: 'traspaso', origenId: '', titulo: 'Traspaso entre tus cuentas', como: 'identidad', traspaso: { sentido: 'entrada' } },
    ]);
  });

  it('«Transferencia A Favor De Gomez Ramirez Jose Antonio» → salida', () => {
    const r = traspasosPropios([mov({ id: 1, amount: -900, description: 'Transferencia A Favor De Gomez Ramirez Jose Antonio' })], CUENTAS, nombres);
    expect(r[0]?.traspaso).toEqual({ sentido: 'salida' });
  });

  it('Sabadell y sus tildes rotas · «Jos Antonio G mez Ram rez» también es el titular', () => {
    expect(laParteEsElTitular('TRANSFERENCIA A FAVOR DE JOS ANTONIO G MEZ RAM REZ', nombres)).toBe(true);
    // Y el nombre solo en la parte · «Jose Antonio» no basta (una palabra útil + un nombre de pila común).
    expect(laParteEsElTitular('TRANSFERENCIA DE ANTONIO PEREZ', nombres)).toBe(false);
  });

  it('el IBAN de una cuenta propia en el texto identifica la cuenta contraria · nace con destino', () => {
    const r = traspasosPropios([mov({ id: 1, amount: -500, description: 'Traspaso a cuenta ES79 2100 0813 6101 2345 6789' })], CUENTAS, nombres);
    expect(r[0]).toMatchObject({ titulo: 'Traspaso a Bankinter', traspaso: { sentido: 'salida', cuentaContrariaId: OTRA } });
  });

  it('el espejo ya importado en otra cuenta propia da la cuenta y la pata · mismo importe, signo contrario, ±3 días', () => {
    const espejo = mov({ id: 77, accountId: OTRA, date: '2025-04-11', amount: 1500 });
    const yo = mov({ id: 1, date: '2025-04-10', amount: -1500, description: 'Transferencia A Favor De Gomez Ramirez Jose Antonio' });
    expect(espejoDe(yo, [espejo], new Set([CUENTA, OTRA, 3]))?.id).toBe(77);
    const r = traspasosPropios([yo], CUENTAS, nombres, [espejo]);
    expect(r[0]).toMatchObject({ piezaId: '77', titulo: 'Traspaso a Bankinter', traspaso: { sentido: 'salida', cuentaContrariaId: OTRA, movimientoEspejoId: 77 } });
  });

  it('dos espejos posibles → no se elige ninguno · traspaso sin par', () => {
    const yo = mov({ id: 1, date: '2025-04-10', amount: -1500, description: 'Transferencia A Favor De Gomez Ramirez Jose Antonio' });
    const otros = [mov({ id: 77, accountId: OTRA, date: '2025-04-11', amount: 1500 }), mov({ id: 78, accountId: 3, date: '2025-04-10', amount: 1500 })];
    expect(traspasosPropios([yo], CUENTAS, nombres, otros)[0]?.traspaso).toEqual({ sentido: 'salida' });
  });

  it('una transferencia a un TERCERO no es un traspaso · aunque lleve mi nombre de pila', () => {
    expect(traspasosPropios([mov({ id: 1, amount: -650, description: 'Transferencia A Favor De Jose Perez Lopez Concepto Alquiler' })], CUENTAS, nombres)).toEqual([]);
    // Ni una en la que mi nombre aparece en el concepto pero la parte es otro.
    expect(traspasosPropios([mov({ id: 2, amount: 300, description: 'Transferencia De Maria Lopez Concepto Para Jose Antonio Gomez' })], CUENTAS, nombres)).toEqual([]);
  });

  it('sin la forma «TRANSFERENCIA DE …», hacen falta TRES palabras del nombre en el texto', () => {
    expect(laParteEsElTitular('ABONO GOMEZ RAMIREZ', nombres)).toBe(false);
    expect(laParteEsElTitular('ABONO GOMEZ RAMIREZ JOSE ANTONIO', nombres)).toBe(true);
  });

  it('la parte se corta donde empieza el concepto', () => {
    expect(parteDeLaTransferencia(normalizarTexto('Transferencia De Gomez Ramirez Jose Antonio Concepto Traspaso Ahorro'))).toBe('GOMEZ RAMIREZ JOSE ANTONIO');
    expect(parteDeLaTransferencia(normalizarTexto('Transferencia Inmediata A Favor De Miguel Lorenzo Ref 12345678'))).toBe('MIGUEL LORENZO');
    expect(parteDeLaTransferencia(normalizarTexto('Recibo Iberdrola'))).toBeNull();
  });

  it('sin nombres ni IBAN no se reconoce nada · no se adivina', () => {
    expect(traspasosPropios([mov({ id: 1, amount: 1500, description: 'Transferencia De Gomez Ramirez Jose Antonio' })], CUENTAS, [])).toEqual([]);
  });

  it('a una cuenta de BAJA no se le da pata · se sabe que es traspaso, sin destino', () => {
    const conBaja = [cuenta(), cuenta({ id: OTRA, iban: 'ES7921000813610123456789', alias: 'Vieja', status: 'DELETED' })];
    const r = traspasosPropios([mov({ id: 1, amount: -500, description: 'Traspaso a ES79 2100 0813 6101 2345 6789' })], conBaja, nombresDelTitular(YO, conBaja));
    expect(r[0]).toMatchObject({ titulo: 'Traspaso entre tus cuentas', traspaso: { sentido: 'salida' } });
  });
});

// ─── nómina ─────────────────────────────────────────────────────────────────

describe('E2.4 · nómina · por concepto del alta o por empresa + cuenta de abono', () => {
  const nomina = {
    id: 5,
    tipo: 'nomina',
    nombre: 'Nómina Orange',
    activa: true,
    cuentaAbono: CUENTA,
    empresa: { nombre: 'Orange Espagne' },
    cuentaCobroIBAN: { iban: 'ES00', diaAbono: 28, conceptoBancario: 'ORANGE ESPAGNE SAU NOMINA' },
  };

  it('el campo del tipo (`cuentaCobroIBAN`) se lee · hasta E2.4 se leía uno que nadie escribe', () => {
    const r = nominasQueSeReconocen([mov({ id: 1, amount: 2450.12, description: 'Transferencia De Orange Espagne Sau Concepto Nomina 03/2025' })], [nomina]);
    expect(r).toEqual([{ movementId: 1, fuente: 'nomina', origenId: '5', titulo: 'Nómina · Nómina Orange', como: 'concepto_cuenta_dia' }]);
  });

  it('las 19 nóminas del histórico, con netos distintos cada año, se reconocen las 19 · el importe no cuenta', () => {
    const lineas: Movement[] = [];
    for (let i = 0; i < 19; i++) {
      lineas.push(mov({ id: 300 + i, date: `${2024 + Math.floor(i / 12)}-${String(1 + (i % 12)).padStart(2, '0')}-28`, amount: 2300 + i * 7.31, description: 'Transferencia De Orange Espagne Sau Concepto Nomina' }));
    }
    expect(nominasQueSeReconocen(lineas, [nomina])).toHaveLength(19);
  });

  it('sin concepto bancario, la EMPRESA en el texto + la cuenta de abono bastan', () => {
    const sinConcepto = { ...nomina, cuentaCobroIBAN: undefined };
    expect(nominasQueSeReconocen([mov({ id: 1, amount: 2450, description: 'Transferencia De Orange Espagne Sau Concepto Nomina' })], [sinConcepto])).toHaveLength(1);
    // …en OTRA cuenta, no.
    expect(nominasQueSeReconocen([mov({ id: 2, accountId: OTRA, amount: 2450, description: 'Transferencia De Orange Espagne Sau Concepto Nomina' })], [sinConcepto])).toEqual([]);
  });

  it('«pone NOMINA» sin la empresa NO basta · la nómina de otra persona entraría igual', () => {
    const sinConcepto = { ...nomina, cuentaCobroIBAN: undefined };
    expect(nominasQueSeReconocen([mov({ id: 1, amount: 1800, description: 'Transferencia De Telefonica Sa Concepto Nomina' })], [sinConcepto])).toEqual([]);
  });

  it('una nómina INACTIVA no reconoce · y un cargo tampoco es una nómina', () => {
    expect(nominasQueSeReconocen([mov({ id: 1, amount: 2450, description: 'Transferencia De Orange Espagne Sau Nomina' })], [{ ...nomina, activa: false }])).toEqual([]);
    expect(nominasQueSeReconocen([mov({ id: 2, amount: -2450, description: 'Transferencia De Orange Espagne Sau Nomina' })], [nomina])).toEqual([]);
  });
});

// ─── préstamos ──────────────────────────────────────────────────────────────

const prestamo = (over: Record<string, unknown> = {}): Prestamo =>
  ({
    id: 'p1',
    nombre: 'Hipoteca Tenderina',
    inmuebleId: '4',
    numeroContrato: '0049 0052 14 3000 4926',
    planPagos: {
      prestamoId: 'p1',
      fechaGeneracion: '',
      periodos: [
        { periodo: 7, devengoDesde: '2025-02-01', devengoHasta: '2025-02-28', fechaCargo: '2025-03-01', cuota: 454.66, interes: 120.4, amortizacion: 334.26, principalFinal: 100000, pagado: false },
        { periodo: 8, devengoDesde: '2025-03-01', devengoHasta: '2025-03-31', fechaCargo: '2025-04-01', cuota: 454.66, interes: 119.1, amortizacion: 335.56, principalFinal: 99664, pagado: false },
      ],
      resumen: { totalIntereses: 0, totalCuotas: 0 },
    },
    ...over,
  }) as unknown as Prestamo;

describe('E2.4 · cuotas de préstamo · el histórico entero', () => {
  it('el banco gira el día 3 lo que el cuadro dice el 1 (fin de semana) · cuadra a ±5 días con importe exacto', () => {
    const r = cuotasQueCuadran([mov({ id: 1, date: '2025-03-03', amount: -454.66, description: 'Liquidacion Periodica Prestamo' })], [prestamo()]);
    expect(r[0]).toMatchObject({ fuente: 'prestamo', piezaId: '7', como: 'fecha_importe' });
    expect(MARGEN_DIAS_CUOTA).toBe(5);
  });

  it('el nº de contrato en el concepto identifica el préstamo · `como: identidad`', () => {
    const m = mov({ id: 1, date: '2025-03-03', amount: -454.66, description: 'Liquidacion Periodica Prestamo 0049 0052 143 0004926' });
    expect(llevaElContrato(m, prestamo())).toBe(true);
    expect(cuotasQueCuadran([m], [prestamo()])[0]).toMatchObject({ piezaId: '7', como: 'identidad' });
  });

  it('con el nº de contrato de OTRO préstamo, este no casa aunque la cuota coincida', () => {
    const otro = prestamo({ id: 'p2', nombre: 'Otro', numeroContrato: '1111 2222 33 4444 5555' });
    const m = mov({ id: 1, date: '2025-03-03', amount: -454.66, description: 'Liquidacion Periodica Prestamo 0049 0052 143 0004926' });
    // Los dos tienen la misma cuota el mismo día · sin identidad sería empate; con ella, gana p1.
    const r = cuotasQueCuadran([m], [otro, prestamo()]);
    expect(r).toHaveLength(1);
    expect(r[0].origenId).toBe('p1');
  });

  it('un periodo del cuadro solo explica UNA línea del lote · la segunda a ±5 días queda sin origen', () => {
    const r = cuotasQueCuadran(
      [
        mov({ id: 1, date: '2025-03-01', amount: -454.66 }),
        mov({ id: 2, date: '2025-03-04', amount: -454.66 }),
      ],
      [prestamo({ planPagos: { ...prestamo().planPagos, periodos: [prestamo().planPagos!.periodos[0]] } })],
    );
    expect(r.map((o) => o.movementId)).toEqual([1]);
  });

  it('a 6 días ya no cuadra · y un céntimo de diferencia tampoco', () => {
    expect(cuotasQueCuadran([mov({ id: 1, date: '2025-03-07', amount: -454.66 })], [prestamo()])).toEqual([]);
    expect(cuotasQueCuadran([mov({ id: 1, date: '2025-03-01', amount: -454.67 })], [prestamo()])).toEqual([]);
  });

  it('78 cuotas de seis años y medio se reconocen todas · el cuadro no depende del presente', () => {
    const periodos = [];
    const lineas: Movement[] = [];
    for (let i = 0; i < 78; i++) {
      const año = 2019 + Math.floor(i / 12);
      const mes = 1 + (i % 12);
      periodos.push({ periodo: i + 1, devengoDesde: '', devengoHasta: '', fechaCargo: `${año}-${String(mes).padStart(2, '0')}-01`, cuota: 454.66, interes: 100, amortizacion: 354.66, principalFinal: 0, pagado: false });
      lineas.push(mov({ id: 500 + i, date: `${año}-${String(mes).padStart(2, '0')}-0${1 + (i % 3)}`, amount: -454.66, description: 'Liquidacion Periodica Prestamo 0049 0052 143 0004926' }));
    }
    const pr = prestamo({ planPagos: { prestamoId: 'p1', fechaGeneracion: '', periodos, resumen: {} } });
    expect(cuotasQueCuadran(lineas, [pr])).toHaveLength(78);
  });
});

describe('E2.4 · las fuentes por definición', () => {
  it('recurrente, renta y traspaso van por `cierrePorDefinicion`; el resto por `cierreDeterminista`', () => {
    expect(Array.from(FUENTES_POR_DEFINICION).sort()).toEqual(['recurrente', 'renta', 'traspaso']);
    expect(esPorDefinicion('prestamo')).toBe(false);
    expect(esPorDefinicion('nomina')).toBe(false);
    expect(esPorDefinicion('renta')).toBe(true);
  });
});
