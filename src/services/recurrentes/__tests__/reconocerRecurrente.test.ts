// E2.3 · el reconocedor de recurrentes, contra conceptos reales.
//
// Los textos del banco son los de los ficheros de Jose (Sabadell, Unicaja,
// Santander) y los de la caracterización de E1.4a. Cada caso dice una cosa del
// modelo: la identidad manda, el calendario desempata, el importe tolera según
// el modo, y con dos candidatos pegados no se elige.

import type { Movement } from '../../db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { diasALaFechaMasCercana, reconocerRecurrente } from '../reconocerRecurrente';

const CUENTA = 9;

const mov = (over: Partial<Movement>): Movement =>
  ({
    id: 1,
    accountId: CUENTA,
    date: '2026-08-12',
    amount: -108.44,
    description: 'RECIBO IBERDROLA CLIENTES SAU',
    status: 'pending',
    unifiedStatus: 'no_planificado',
    source: 'import',
    category: { tipo: 'Gastos' },
    ...over,
  }) as Movement;

const compromiso = (over: Partial<CompromisoRecurrente> & { id: number }): CompromisoRecurrente =>
  ({
    ambito: 'inmueble',
    inmuebleId: 4,
    alias: 'Luz Tenderina',
    tipo: 'suministro',
    proveedor: { nombre: 'Iberdrola' },
    patron: { tipo: 'mensualDiaFijo', dia: 12 },
    importe: { modo: 'variable', importeMedio: 100 },
    cuentaCargo: CUENTA,
    conceptoBancario: 'IBERDROLA CLIENTES SAU',
    metodoPago: 'domiciliacion',
    categoria: 'inmueble.suministros',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: '2025-01-12',
    estado: 'activo',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...over,
  }) as CompromisoRecurrente;

describe('E2.3 · la IDENTIDAD manda', () => {
  const tenderina = compromiso({ id: 1, inmuebleId: 4, alias: 'Luz Tenderina', cups: 'ES0021000012345678AB' });
  const uria = compromiso({ id: 2, inmuebleId: 7, alias: 'Luz Uría', cups: 'ES0021000087654321CD' });

  it('dos Iberdrola de dos pisos · el CUPS del concepto dice cuál, aunque el importe se parezca más al otro', () => {
    // El importe (63,10) está más cerca de la media de Uría que de la de Tenderina.
    const r = reconocerRecurrente(
      mov({ amount: -63.1, description: 'RECIBO IBERDROLA CLIENTES SAU CUPS ES0021000012345678AB' }),
      [compromiso({ ...tenderina, importe: { modo: 'variable', importeMedio: 110 } }), compromiso({ ...uria, importe: { modo: 'variable', importeMedio: 60 } })]
    );
    expect(r?.compromiso.id).toBe(1);
    expect(r?.inmuebleId).toBe(4);
    expect(r?.porIdentidad).toBe('cups');
    expect(r?.confianza).toBeGreaterThanOrEqual(90);

    const r2 = reconocerRecurrente(
      mov({ amount: -63.1, description: 'RECIBO IBERDROLA CLIENTES SAU CUPS ES0021000087654321CD' }),
      [tenderina, uria]
    );
    expect(r2?.compromiso.id).toBe(2);
    expect(r2?.inmuebleId).toBe(7);
  });

  it('sin CUPS en el concepto, dos Iberdrola idénticas NO se eligen a ciegas', () => {
    const r = reconocerRecurrente(mov({ amount: -63.1 }), [tenderina, uria]);
    expect(r).toBeNull();
  });

  it('el nº de contrato identifica · Sabadell «PRESTAMOS ADEUDO CUOTA N.8078716546»', () => {
    const r = reconocerRecurrente(
      mov({ amount: -674.02, description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/08/25' }),
      [
        compromiso({ id: 5, alias: 'Préstamo coche', proveedor: { nombre: 'Sabadell Consumer' }, conceptoBancario: '', numeroContrato: '8078716546', importe: { modo: 'fijo', importe: 674.02 } }),
        compromiso({ id: 6, alias: 'Otro préstamo', proveedor: { nombre: 'Sabadell Consumer' }, conceptoBancario: '', numeroContrato: '8078716547', importe: { modo: 'fijo', importe: 674.02 } }),
      ]
    );
    expect(r?.compromiso.id).toBe(5);
    expect(r?.porIdentidad).toBe('numeroContrato');
  });

  it('la identidad vale aunque la domiciliación haya cambiado de cuenta', () => {
    const r = reconocerRecurrente(
      mov({ accountId: 99, description: 'RECIBO IBERDROLA CUPS ES0021000012345678AB' }),
      [tenderina]
    );
    expect(r?.compromiso.id).toBe(1);
  });

  it('el campo legacy `proveedor.referencia` también identifica', () => {
    const r = reconocerRecurrente(
      mov({ description: 'RECIBO IBERDROLA CUPS ES0021000012345678AB' }),
      [compromiso({ id: 9, cups: undefined, proveedor: { nombre: 'Iberdrola', referencia: 'ES00 2100 0012 3456 78AB' } })]
    );
    expect(r?.porIdentidad).toBe('cups');
  });
});

describe('E2.3 · Sabadell · el nº de factura es ruido, el NIF identifica', () => {
  const gas = compromiso({
    id: 11,
    alias: 'Gas Tenderina',
    proveedor: { nombre: 'Iberdrola', nif: 'A95554630' },
    conceptoBancario: 'IBERDROLA GAS',
    importe: { modo: 'variable', importeMedio: 45 },
  });

  it.each(['104', '105', '106'])('«ELECTRICIDAD IBERDROLA … IBERDROLA GAS %s» + NIF en Referencia 1 → el mismo recurrente', (factura) => {
    const r = reconocerRecurrente(
      mov({
        amount: -38.2,
        description: `ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS ${factura}`,
        reference: 'A95554630001',
      }),
      [gas]
    );
    expect(r?.compromiso.id).toBe(11);
    expect(r?.porIdentidad).toBe('nif');
  });

  it('el NIF solo es concluyente si señala a UN compromiso · con dos del mismo acreedor decide el texto', () => {
    const luz = compromiso({
      id: 12,
      inmuebleId: 7,
      alias: 'Luz Uría',
      proveedor: { nombre: 'Iberdrola', nif: 'A95554630' },
      conceptoBancario: 'IBERDROLA LUZ',
      importe: { modo: 'variable', importeMedio: 80 },
    });
    const r = reconocerRecurrente(
      mov({ amount: -38.2, description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105', reference: 'A95554630001' }),
      [gas, luz]
    );
    expect(r?.compromiso.id).toBe(11);
    expect(r?.porIdentidad).toBeUndefined();
    expect(r?.razones).toContain('nif_ambiguo');
    // Y la confianza es la de un candidato POR TEXTO (80 + 5 concepto + 5 calendario ·
    // el día 12 del patrón mensual), no la de identidad rebajada.
    expect(r?.confianza).toBe(90);
  });

  it('con NIF ambiguo vuelven a mandar los filtros de «sin identidad» · otra cuenta o un fijo que no cuadra quedan fuera', () => {
    const luz = compromiso({
      id: 12,
      inmuebleId: 7,
      alias: 'Luz Uría',
      proveedor: { nombre: 'Iberdrola', nif: 'A95554630' },
      conceptoBancario: 'IBERDROLA LUZ',
      importe: { modo: 'variable', importeMedio: 80 },
    });
    // El gas está domiciliado en OTRA cuenta · sin identidad concluyente ya no vale.
    const gasOtraCuenta = compromiso({ ...gas, cuentaCargo: 99 });
    const r1 = reconocerRecurrente(
      mov({ amount: -38.2, description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105', reference: 'A95554630001' }),
      [gasOtraCuenta, luz]
    );
    // Queda solo la luz, por texto de proveedor (la palabra LUZ no está) · gana sin rival.
    expect(r1?.compromiso.id).toBe(12);
    expect(r1?.razones).toContain('nif_ambiguo');

    // El gas es FIJO de 45 y llegan 38,20 · sin identidad concluyente el importe descarta.
    const gasFijo = compromiso({ ...gas, importe: { modo: 'fijo', importe: 45 } });
    const r2 = reconocerRecurrente(
      mov({ amount: -38.2, description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105', reference: 'A95554630001' }),
      [gasFijo, luz]
    );
    expect(r2?.compromiso.id).toBe(12);
  });
});

describe('E2.3 · el CALENDARIO desempata', () => {
  // Agua bimestral · Tenderina en meses pares (ancla febrero), Carles Buigas en impares.
  const aguaTenderina = compromiso({
    id: 21,
    inmuebleId: 4,
    alias: 'Agua Tenderina',
    proveedor: { nombre: 'Aqualia' },
    conceptoBancario: 'FCC AQUALIA',
    patron: { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 2, dia: 20 },
    importe: { modo: 'variable', importeMedio: 80 },
  });
  const aguaBuigas = compromiso({
    id: 22,
    inmuebleId: 7,
    alias: 'Agua Carles Buigas',
    proveedor: { nombre: 'Aqualia' },
    conceptoBancario: 'FCC AQUALIA',
    patron: { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 1, dia: 20 },
    importe: { modo: 'variable', importeMedio: 80 },
  });

  it('el cargo de AGOSTO (mes par) es de Tenderina', () => {
    const r = reconocerRecurrente(mov({ date: '2026-08-21', amount: -87.4, description: 'FCC AQUALIA 447497 874010012213' }), [aguaTenderina, aguaBuigas]);
    expect(r?.compromiso.id).toBe(21);
    expect(r?.calendario).toBe('cuadra');
  });

  it('el cargo de SEPTIEMBRE (mes impar) es de Carles Buigas', () => {
    const r = reconocerRecurrente(mov({ date: '2026-09-19', amount: -87.4, description: 'FCC AQUALIA 447497 874010012213' }), [aguaTenderina, aguaBuigas]);
    expect(r?.compromiso.id).toBe(22);
  });

  it('un mensual que no clava el día no resta · el banco mueve el cargo', () => {
    const r = reconocerRecurrente(mov({ date: '2026-08-19' }), [compromiso({ id: 1, patron: { tipo: 'mensualDiaFijo', dia: 12 } })]);
    expect(r?.compromiso.id).toBe(1);
    expect(r?.calendario).toBe('neutro');
  });

  it('con `diaCargoIncierto` el calendario no opina', () => {
    expect(diasALaFechaMasCercana(compromiso({ id: 1, diaCargoIncierto: true }), new Date(2026, 7, 12))).toBeNull();
  });

  it('un anual (IBI junio y noviembre) en agosto está LEJOS', () => {
    const ibi = compromiso({
      id: 31,
      alias: 'IBI Tenderina',
      proveedor: { nombre: 'Ayto Oviedo' },
      conceptoBancario: 'IBI AYTO OVIEDO',
      patron: { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15 },
      importe: { modo: 'fijo', importe: 321.5 },
    });
    const r = reconocerRecurrente(mov({ date: '2026-08-03', amount: -321.5, description: 'RECIBO IBI AYTO OVIEDO' }), [ibi]);
    expect(r?.calendario).toBe('lejos');
    expect(r!.confianza).toBeLessThan(80);
    const enJunio = reconocerRecurrente(mov({ date: '2026-06-16', amount: -321.5, description: 'RECIBO IBI AYTO OVIEDO' }), [ibi]);
    expect(enJunio?.calendario).toBe('cuadra');
    expect(enJunio!.confianza).toBe(95);
  });
});

describe('E2.3 · TOLERANCIA por modo de importe', () => {
  it('un VARIABLE (luz 40 → 55) casa aunque el importe cambie · el importe solo valida plausibilidad', () => {
    const luz = compromiso({ id: 1, importe: { modo: 'variable', importeMedio: 40 } });
    expect(reconocerRecurrente(mov({ amount: -55 }), [luz])?.importe).toBe('plausible');
    expect(reconocerRecurrente(mov({ amount: -40 }), [luz])?.importe).toBe('exacto');
    // Fuera de todo rango (×10) ya no es plausible.
    expect(reconocerRecurrente(mov({ amount: -400 }), [luz])).toBeNull();
  });

  it('un FIJO con importe distinto NO se da por bueno solo', () => {
    const gas = compromiso({ id: 1, importe: { modo: 'fijo', importe: 56 }, proveedor: { nombre: 'Naturgy' }, conceptoBancario: 'NATURGY' });
    expect(reconocerRecurrente(mov({ amount: -56, description: 'RECIBO NATURGY IBERIA SA' }), [gas])?.importe).toBe('exacto');
    expect(reconocerRecurrente(mov({ amount: -56.4, description: 'RECIBO NATURGY IBERIA SA' }), [gas])?.importe).toBe('tolerancia');
    expect(reconocerRecurrente(mov({ amount: -61, description: 'RECIBO NATURGY IBERIA SA' }), [gas])).toBeNull();
  });

  it('un FIJO con identidad y otro importe se propone, pero a confirmar (75)', () => {
    const gas = compromiso({ id: 1, importe: { modo: 'fijo', importe: 56 }, cups: 'ES0021000012345678AB' });
    // El día 25 no es el del patrón (12) · el calendario no suma ni resta.
    const r = reconocerRecurrente(mov({ date: '2026-08-25', amount: -61, description: 'RECIBO IBERDROLA CUPS ES0021000012345678AB' }), [gas]);
    expect(r?.confianza).toBe(75);
    expect(r?.razones).toContain('importe_no_cuadra');
  });

  it('`diferenciadoPorMes` da la cifra del mes · agosto', () => {
    const c = compromiso({
      id: 1,
      importe: { modo: 'diferenciadoPorMes', importesPorMes: [138, 130, 110, 90, 80, 71, 70, 75, 85, 100, 120, 135] },
    });
    expect(reconocerRecurrente(mov({ date: '2026-08-12', amount: -75 }), [c])?.importe).toBe('exacto');
    expect(reconocerRecurrente(mov({ date: '2026-08-12', amount: -138 }), [c])).toBeNull();
  });
});

describe('E2.3 · reparto, signo y lo que ya no vale', () => {
  it('un recibo repartido entre pisos viaja con su reparto · se atribuye al primero', () => {
    const c = compromiso({
      id: 1,
      inmuebleId: undefined,
      reparto: [{ inmuebleId: 4, porcentaje: 50 }, { inmuebleId: 7, porcentaje: 50 }],
    });
    const r = reconocerRecurrente(mov({}), [c]);
    expect(r?.inmuebleId).toBe(4);
    expect(r?.reparto).toEqual([{ inmuebleId: 4, porcentaje: 50 }, { inmuebleId: 7, porcentaje: 50 }]);
  });

  it('un ABONO nunca es un recurrente de gasto', () => {
    expect(reconocerRecurrente(mov({ amount: 108.44 }), [compromiso({ id: 1 })])).toBeNull();
  });

  it('misma cuenta e importe parecido pero SIN texto ni identidad · ya no casa (así nacían los falsos positivos)', () => {
    const c = compromiso({ id: 1, conceptoBancario: '', proveedor: { nombre: 'Iberdrola' } });
    expect(reconocerRecurrente(mov({ description: 'ADEUDO CANAL ISABEL II' }), [c])).toBeNull();
  });

  it('el `conceptoBancario` casa por TODAS sus palabras, como la nómina', () => {
    const c = compromiso({ id: 1, conceptoBancario: 'CCPP CL TE0146B7', proveedor: { nombre: 'Comunidad' } });
    expect(reconocerRecurrente(mov({ description: 'CCPP CL TE0146B7 006300001100', amount: -100 }), [c])?.porTexto).toBe(true);
    expect(reconocerRecurrente(mov({ description: 'CCPP CL OTRA 006300001100', amount: -100 }), [c])).toBeNull();
  });

  it('la caracterización de E1.4a se conserva · Naturgy 56 exacto = 90', () => {
    const c = {
      id: 3, alias: 'Gas Tenderina', ambito: 'inmueble', inmuebleId: 4, cuentaCargo: CUENTA, estado: 'activo',
      importe: { modo: 'fijo', importe: 56 }, proveedor: { nombre: 'Naturgy' }, categoria: 'suministros',
    } as unknown as CompromisoRecurrente;
    const r = reconocerRecurrente(mov({ date: '2026-08-15', amount: -56, description: 'RECIBO NATURGY IBERIA SA' }), [c]);
    expect(r?.confianza).toBe(90);
    expect(r?.razones).toEqual(['texto', 'importe_exacto']);
  });

  it('el concepto bancario pesa más que el nombre del proveedor (+5) · la caracterización (sin concepto) no cambia', () => {
    const conConcepto = compromiso({ id: 1, conceptoBancario: 'IBERDROLA CLIENTES SAU', patron: { tipo: 'mensualDiaFijo', dia: 1 } });
    const soloProveedor = compromiso({ id: 2, conceptoBancario: '', patron: { tipo: 'mensualDiaFijo', dia: 1 } });
    expect(reconocerRecurrente(mov({}), [conConcepto])?.confianza).toBe(85);
    expect(reconocerRecurrente(mov({}), [soloProveedor])?.confianza).toBe(80);
  });
});
