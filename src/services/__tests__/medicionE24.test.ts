// E2.4 · MEDICIÓN · un lote tipo Santander con las estructuras del encargo.
//
// El fichero real (1.341 líneas) no está en el repo y no se inventa. Lo que se
// mide aquí es un lote SINTÉTICO construido con los conceptos que Jose pegó en
// el encargo y las cifras que él contó a mano: 78 cuotas con nº de contrato,
// 21 seguros de decesos por mandato, 12 renting Ayvens, 21 comunidad, 13 agua
// variable bimestral, 19 nóminas Orange (neto distinto cada año), 18 rentas de
// Tenderina, 237 traspasos yo↔yo (con y sin IBAN), y ruido que NO tiene
// estructura dada de alta (Revolut, PayPal, Planeta, Sanitas, comunidad
// Manresa, el alquiler que paga Gonzalo, Bizum de terceros) y que NO debe
// reconocerse: eso es E2.5/E2.6.
//
// Se cuenta lo que `reconocerDeterministasDeLineas` reconoce SIN ninguna
// previsión en `treasuryEvents`. La cifra «antes» se obtiene corriendo este
// mismo fichero contra `main` (ver la descripción del PR).

import { initDB } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import { reconocerDeterministasDeLineas } from '../deterministas/matcheoDeterminista';

const SANTANDER = 1;
const BANKINTER = 2;
const REVOLUT = 3;
const AHORA = '2026-08-25T00:00:00.000Z';

const STORES = ['movements', 'lineasExtracto', 'compromisosRecurrentes', 'contracts', 'accounts', 'personalData', 'treasuryEvents', 'prestamos', 'ingresos', 'movementLearningRules'];

function mm(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha del mes i-ésimo (0 = enero 2019) con el día dado. */
function fecha(i: number, dia: number, desdeAño = 2019): string {
  return `${desdeAño + Math.floor(i / 12)}-${mm(1 + (i % 12))}-${mm(dia)}`;
}

let siguienteId = 1;
function linea(over: Partial<LineaExtractoPersistida> & { conceptoLiteral: string; importe: number; fechaOperacion: string }): LineaExtractoPersistida {
  const id = siguienteId++;
  return {
    id,
    fechaValor: over.fechaOperacion,
    importBatchId: 'lote-medicion',
    accountId: SANTANDER,
    hashLinea: `h-${id}`,
    hashMovement: `m-${id}`,
    estado: 'pendiente',
    movementIds: [],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  } as LineaExtractoPersistida;
}

interface Lote {
  lineas: LineaExtractoPersistida[];
  grupo: Map<number, string>;
}

function lote(): Lote {
  const lineas: LineaExtractoPersistida[] = [];
  const grupo = new Map<number, string>();
  const add = (g: string, l: LineaExtractoPersistida) => {
    lineas.push(l);
    grupo.set(l.id as number, g);
  };

  // 78 cuotas · el banco gira el 1, 2 o 3 según el calendario.
  for (let i = 0; i < 78; i++) {
    add('prestamo', linea({ fechaOperacion: fecha(i, 1 + (i % 3)), importe: -454.66, conceptoLiteral: 'Liquidacion Periodica Prestamo 0049 0052 143 0004926' }));
  }
  // 21 seguros de decesos · día 2, 24,90 fijo, mandato.
  for (let i = 0; i < 21; i++) {
    add('decesos', linea({ fechaOperacion: fecha(i, 2, 2024), importe: -24.9, conceptoLiteral: 'Recibo Segurcaixa Adeslas Mandato 07085234611' }));
  }
  // 12 renting Ayvens · día 8, 351,13 fijo, sin identificador.
  for (let i = 0; i < 12; i++) {
    add('ayvens', linea({ fechaOperacion: fecha(i, 8, 2025), importe: -351.13, conceptoLiteral: 'Recibo Ayvens Espana Sau Renting Vehiculo' }));
  }
  // 21 comunidad Tenderina · fijo 95, día 5.
  for (let i = 0; i < 21; i++) {
    add('comunidad', linea({ fechaOperacion: fecha(i, 5, 2024), importe: -95, conceptoLiteral: 'Recibo Comunidad Propietarios Tenderina 12' }));
  }
  // 13 agua Canal Isabel II · variable, bimestral (meses pares), día 15.
  for (let i = 0; i < 13; i++) {
    const mesIndex = 1 + i * 2; // feb, abr, jun… desde 2024
    add('agua', linea({ fechaOperacion: fecha(mesIndex, 15, 2024), importe: -(35 + (i % 5) * 3.7), conceptoLiteral: 'Recibo Canal De Isabel II Sa Agua' }));
  }
  // 19 nóminas Orange · neto distinto cada mes/año.
  for (let i = 0; i < 19; i++) {
    add('nomina', linea({ fechaOperacion: fecha(i, 28, 2024), importe: 2312.45 + i * 9.13, conceptoLiteral: 'Transferencia De Orange Espagne Sau Concepto Nomina' }));
  }
  // 18 rentas Tenderina · 650, día 5.
  for (let i = 0; i < 18; i++) {
    add('renta', linea({ fechaOperacion: fecha(1 + i, 5, 2024), importe: 650, conceptoLiteral: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Alquiler Tenderina' }));
  }
  // 237 traspasos propios · entradas y salidas, unas con IBAN y otras sin.
  for (let i = 0; i < 237; i++) {
    const salida = i % 2 === 0;
    const conIban = i % 5 === 0;
    const importe = 200 + (i % 9) * 150;
    add(
      'traspaso',
      linea({
        fechaOperacion: fecha(Math.floor(i / 4), 1 + (i % 27), 2020),
        importe: salida ? -importe : importe,
        conceptoLiteral: salida
          ? `Transferencia A Favor De Gomez Ramirez Jose Antonio${conIban ? ' ES79 2100 0813 6101 2345 6789' : ''} Concepto Traspaso`
          : `Transferencia De Gomez Ramirez Jose Antonio${conIban ? ' Desde ES79 2100 0813 6101 2345 6789' : ''} Concepto Ahorro`,
      }),
    );
  }
  // RUIDO · sin estructura dada de alta · NADA de esto debe reconocerse.
  for (let i = 0; i < 20; i++) add('ruido', linea({ fechaOperacion: fecha(i, 12, 2024), importe: -(50 + i), conceptoLiteral: 'Revolut**1234* Dublin' }));
  for (let i = 0; i < 5; i++) add('ruido', linea({ fechaOperacion: fecha(i, 20, 2024), importe: -29.99, conceptoLiteral: 'Paypal *Spotify' }));
  for (let i = 0; i < 3; i++) add('ruido', linea({ fechaOperacion: fecha(i * 4, 10, 2024), importe: -19.9, conceptoLiteral: 'Recibo Planeta Deagostini' }));
  for (let i = 0; i < 6; i++) add('ruido', linea({ fechaOperacion: fecha(i, 3, 2025), importe: -68.4, conceptoLiteral: 'Recibo Sanitas Sa De Seguros' }));
  for (let i = 0; i < 12; i++) add('ruido', linea({ fechaOperacion: fecha(i, 7, 2025), importe: -80, conceptoLiteral: 'Recibo Comunidad Propietarios Manresa 3' }));
  for (let i = 0; i < 7; i++) add('ruido', linea({ fechaOperacion: fecha(i, 1, 2025), importe: -900, conceptoLiteral: 'Transferencia A Favor De Gonzalo Martin Perez Concepto Alquiler' }));
  for (let i = 0; i < 5; i++) add('ruido', linea({ fechaOperacion: fecha(i, 14, 2025), importe: 25, conceptoLiteral: 'Bizum De Laura Sanchez Ruiz Concepto Cena' }));
  for (let i = 0; i < 3; i++) add('ruido', linea({ fechaOperacion: fecha(i, 9, 2025), importe: 300, conceptoLiteral: 'Transferencia De Maria Lopez Garcia Concepto Para Jose Antonio' }));
  add('ruido', linea({ fechaOperacion: '2025-04-05', importe: 300, conceptoLiteral: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Fianza Parcial' }));
  add('ruido', linea({ fechaOperacion: '2025-04-02', importe: -31.5, conceptoLiteral: 'Recibo Segurcaixa Adeslas Mandato 99999999999' }));

  return { lineas, grupo };
}

async function sembrar(store: string, filas: unknown[]): Promise<void> {
  const d = await initDB();
  for (const f of filas) await d.put(store as never, f as never);
}

async function sembrarEstructuras(): Promise<void> {
  await sembrar('accounts', [
    { id: SANTANDER, iban: 'ES9121000418450200051332', alias: 'Santander', status: 'ACTIVE', activa: true, createdAt: AHORA, updatedAt: AHORA },
    { id: BANKINTER, iban: 'ES7921000813610123456789', alias: 'Bankinter', status: 'ACTIVE', activa: true, createdAt: AHORA, updatedAt: AHORA },
    { id: REVOLUT, iban: 'ES1000492352082414205416', alias: 'Revolut', status: 'ACTIVE', activa: true, createdAt: AHORA, updatedAt: AHORA },
  ]);
  await sembrar('personalData', [{ id: 1, nombre: 'José Antonio', apellidos: 'Gómez Ramírez', dni: '', direccion: '' }]);

  const periodos = [];
  for (let i = 0; i < 78; i++) {
    periodos.push({ periodo: i + 1, devengoDesde: '', devengoHasta: '', fechaCargo: fecha(i, 1), cuota: 454.66, interes: 120, amortizacion: 334.66, principalFinal: 0, pagado: false });
  }
  await sembrar('prestamos', [{ id: 'p1', nombre: 'Hipoteca Tenderina', inmuebleId: '4', numeroContrato: '0049 0052 14 3000 4926', cuentaCargoId: String(SANTANDER), planPagos: { prestamoId: 'p1', fechaGeneracion: '', periodos, resumen: {} } }]);

  await sembrar('compromisosRecurrentes', [
    { id: 11, alias: 'Seguro decesos', ambito: 'personal', tipo: 'seguro', proveedor: { nombre: 'Segurcaixa Adeslas' }, numeroContrato: '07085234611', patron: { tipo: 'mensualDiaFijo', dia: 2 }, importe: { modo: 'fijo', importe: 24.9 }, cuentaCargo: SANTANDER, conceptoBancario: 'SEGURCAIXA ADESLAS', metodoPago: 'domiciliacion', categoria: 'seguros', estado: 'activo' },
    { id: 12, alias: 'Renting Ayvens', ambito: 'personal', tipo: 'otro', proveedor: { nombre: 'Ayvens' }, patron: { tipo: 'mensualDiaFijo', dia: 8 }, importe: { modo: 'fijo', importe: 351.13 }, cuentaCargo: SANTANDER, conceptoBancario: 'AYVENS', metodoPago: 'domiciliacion', categoria: 'transporte', estado: 'activo' },
    { id: 13, alias: 'Comunidad Tenderina', ambito: 'inmueble', inmuebleId: 4, tipo: 'comunidad', proveedor: { nombre: 'Comunidad Propietarios Tenderina' }, patron: { tipo: 'mensualDiaFijo', dia: 5 }, importe: { modo: 'fijo', importe: 95 }, cuentaCargo: SANTANDER, conceptoBancario: 'COMUNIDAD PROPIETARIOS TENDERINA', metodoPago: 'domiciliacion', categoria: 'comunidad_inmueble', estado: 'activo' },
    { id: 14, alias: 'Agua Tenderina', ambito: 'inmueble', inmuebleId: 4, tipo: 'suministro', subtipo: 'agua', proveedor: { nombre: 'Canal de Isabel II' }, patron: { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 2, dia: 15 }, importe: { modo: 'variable', importeMedio: 42 }, cuentaCargo: SANTANDER, conceptoBancario: 'CANAL DE ISABEL II', metodoPago: 'domiciliacion', categoria: 'suministros', estado: 'activo' },
  ]);

  await sembrar('ingresos', [{ id: 5, tipo: 'nomina', nombre: 'Nómina Orange', activa: true, cuentaAbono: SANTANDER, empresa: { nombre: 'Orange Espagne' }, cuentaCobroIBAN: { iban: 'ES91', diaAbono: 28, conceptoBancario: 'ORANGE ESPAGNE SAU NOMINA' } }]);

  await sembrar('contracts', [{ id: 21, inmuebleId: 4, unidadTipo: 'vivienda', inquilino: { nombre: 'Miguel', apellidos: 'Lorenzo Cabanelas', dni: '', telefono: '', email: '' }, fechaInicio: '2024-02-01', fechaFin: '2029-01-31', rentaMensual: 650, diaPago: 5, margenGraciaDias: 5, cuentaCobroId: SANTANDER, estadoContrato: 'activo', historicoIndexaciones: [] }]);
}

beforeEach(async () => {
  const d = await initDB();
  for (const s of STORES) {
    try {
      await d.clear(s as never);
    } catch {
      // un store que no exista no bloquea la medición
    }
  }
  siguienteId = 1;
});

it('E2.4 · el lote tipo Santander · lo que se reconoce SIN previsión, por grupo', async () => {
  await sembrarEstructuras();
  const { lineas, grupo } = lote();
  expect(lineas).toHaveLength(78 + 21 + 12 + 21 + 13 + 19 + 18 + 237 + 63);

  const r = await reconocerDeterministasDeLineas(lineas);

  const porGrupo: Record<string, number> = {};
  for (const g of new Set(grupo.values())) porGrupo[g] = 0;
  const fuentePorGrupo: Record<string, Set<string>> = {};
  for (const [lineaId, o] of r.origenes) {
    const g = grupo.get(lineaId) as string;
    porGrupo[g] += 1;
    (fuentePorGrupo[g] ??= new Set()).add(o.fuente);
  }
  const resumen = { ...porGrupo, total: r.origenes.size, deLineas: lineas.length };

  // Lo que la estructura ya dada de alta debe explicar · entero.
  expect(resumen).toEqual({
    prestamo: 78,
    decesos: 21,
    ayvens: 12,
    comunidad: 21,
    agua: 13,
    nomina: 19,
    renta: 18,
    traspaso: 237,
    ruido: 0,
    total: 78 + 21 + 12 + 21 + 13 + 19 + 18 + 237,
    deLineas: lineas.length,
  });
  expect(fuentePorGrupo.prestamo).toEqual(new Set(['prestamo']));
  expect(fuentePorGrupo.decesos).toEqual(new Set(['recurrente']));
  expect(fuentePorGrupo.nomina).toEqual(new Set(['nomina']));
  expect(fuentePorGrupo.renta).toEqual(new Set(['renta']));
  expect(fuentePorGrupo.traspaso).toEqual(new Set(['traspaso']));
});
