// ============================================================================
// La ficha aprende a capturar un gasto con varios cargos al año
// ============================================================================
//
// El IBI de Asturias se paga dos veces: 200 € el 15 de junio y 120 € el 11 de
// noviembre. Como la ficha solo sabía pedir UN importe, había que darlo de alta
// dos veces («IBI 1», «IBI 2»). El modelo admite `porPago` desde el principio y
// el cálculo lo resuelve; lo que faltaba era la captura, que se perdió en #1480
// al retirar los wizards.
//
// Lo que vigila este fichero es que el dato se guarde entero —importe Y día de
// cada cargo—, que al reabrir esté igual, y sobre todo que la ficha NO PISE lo
// que no sabe representar: un `diferenciadoPorMes` de la detección automática
// se abría en modo «Fijo» con el importe vacío y al guardar se quedaba en 0.
// ============================================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RowForm from '../RowForm';
import type { Account } from '../../../../../../services/db';
import type {
  CompromisoRecurrente,
  ImporteEvento,
  PatronRecurrente,
} from '../../../../../../types/compromisosRecurrentes';
import { expandirPatron, calcularImporte } from '../../../../../../services/personal/patronCalendario';

const mockActualizar = jest.fn();
jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: (...a: unknown[]) => mockActualizar(...a),
}));
jest.mock('../../../../../../services/tarjetasService', () => ({ listarTarjetas: async () => [] }));

const mockToast = jest.fn();
jest.mock('../../../../../../design-system/v5', () => ({
  showToastV5: (...a: unknown[]) => mockToast(...a),
  Icons: new Proxy({}, { get: () => () => null }),
}));

const CUENTAS = [
  { id: 1, alias: 'Santander', tipo: 'CORRIENTE' },
  { id: 2, alias: 'Bankinter', tipo: 'CORRIENTE' },
] as Account[];

const IBI_PORPAGO: ImporteEvento = { modo: 'porPago', importesPorPago: { 6: 200, 11: 120 } };
const IBI_PATRON: PatronRecurrente = {
  tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15, diaPagoPorMes: { 6: 15, 11: 11 },
};

const compromiso = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 7, alias: 'IBI', patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 0 },
    cuentaCargo: 1, conceptoBancario: 'IBI', metodoPago: 'domiciliacion',
    categoria: 'inmueble.ibi', bolsaPresupuesto: 'inmueble', responsable: 'titular',
    ambito: 'inmueble', inmuebleId: 1, fechaInicio: '2026-01-01', estado: 'activo',
    createdAt: '', updatedAt: '', ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = compromiso()) =>
  render(<RowForm compromiso={c} accounts={CUENTAS} onSaved={jest.fn()} />);

beforeEach(() => {
  mockActualizar.mockReset();
  mockActualizar.mockImplementation(async (_id, patch) => ({ ...compromiso(), ...patch }));
  mockToast.mockReset();
});

const modoImporte = () => screen.getByLabelText('Modo de importe') as HTMLSelectElement;
const cuentaCargo = () => screen.getByLabelText('Cuenta de cargo') as HTMLSelectElement;
const opcionesDe = (s: HTMLSelectElement) => within(s).getAllByRole('option').map((o) => o.textContent);
const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => fireEvent.click(screen.getByRole('button', { name: /^Guardar/ }));
const patchGuardado = () => mockActualizar.mock.calls[0][1];

/** Teclea un cargo en la línea `i` (0-based), que ya debe existir. */
const escribirCargo = (i: number, mes: number, importe: string, dia?: string) => {
  fireEvent.change(screen.getByLabelText(`Mes (cargo ${i + 1})`), { target: { value: String(mes) } });
  fireEvent.change(screen.getByLabelText(`Importe (cargo ${i + 1})`), { target: { value: importe } });
  if (dia !== undefined) {
    fireEvent.change(screen.getByLabelText(`Día (cargo ${i + 1})`), { target: { value: dia } });
  }
};

// ─── dar de alta el IBI de dos pagos ────────────────────────────────────────

describe('crear un gasto por cargos', () => {
  it('el modo se ofrece en la ficha', () => {
    pintar();
    expect(opcionesDe(modoImporte())).toContain('Por cargo · varios al año');
  });

  it('IBI · jun 200 el 15 y nov 120 el 11 · se guarda entero', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });

    escribirCargo(0, 6, '200', '15');
    fireEvent.click(screen.getByRole('button', { name: /Añadir cargo/i }));
    escribirCargo(1, 11, '120', '11');
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({ modo: 'porPago', importesPorPago: { 6: 200, 11: 120 } });
    expect(patchGuardado().patron).toEqual({
      tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15, diaPagoPorMes: { 6: 15, 11: 11 },
    });
  });

  // Lo que de verdad importa: que las previsiones caigan el día bueno. El día
  // vive en el patrón porque es de ahí de donde salen las fechas.
  it('las previsiones caen el 15/6 y el 11/11 · no el 1, ni el mismo día', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    escribirCargo(0, 6, '200', '15');
    fireEvent.click(screen.getByRole('button', { name: /Añadir cargo/i }));
    escribirCargo(1, 11, '120', '11');
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());

    const { patron, importe } = patchGuardado();
    const fechas = expandirPatron(patron, '2026-01-01', '2026-12-31');
    expect(fechas.map((f) => `${f.getDate()}/${f.getMonth() + 1}`)).toEqual(['15/6', '11/11']);
    expect(fechas.map((f) => calcularImporte(importe, f))).toEqual([200, 120]);
  });

  it('el día en blanco es el 1', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    escribirCargo(0, 6, '200');
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().patron.diaPagoPorMes).toEqual({ 6: 1 });
  });

  // El patrón sale de los MISMOS cargos que el importe, así que un mes del
  // patrón sin importe —lo que hace lanzar a `calcularImporte` y tumba seis
  // pantallas— no se puede construir desde aquí.
  it('COHERENCIA · el patrón no puede llevar un mes sin importe', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    escribirCargo(0, 6, '200', '15');
    fireEvent.click(screen.getByRole('button', { name: /Añadir cargo/i }));
    escribirCargo(1, 11, '120', '11');
    guardar();
    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());

    const { patron, importe } = patchGuardado();
    for (const m of patron.mesesPago) expect(importe.importesPorPago[m]).toBeGreaterThan(0);
    const fechas = expandirPatron(patron, '2026-01-01', '2027-12-31');
    for (const f of fechas) expect(() => calcularImporte(importe, f)).not.toThrow();
  });
});

// ─── no dejar cargos a medio ────────────────────────────────────────────────

describe('un cargo sin importe no se puede añadir', () => {
  it('el botón de añadir se apaga mientras haya uno incompleto', () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    const añadir = screen.getByRole('button', { name: /Añadir cargo/i }) as HTMLButtonElement;
    expect(añadir.disabled).toBe(true);

    escribirCargo(0, 6, '200', '15');
    expect((screen.getByRole('button', { name: /Añadir cargo/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('y guardar con uno a medio avisa en vez de perderlo en silencio', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    escribirCargo(0, 6, '200', '15');
    fireEvent.click(screen.getByRole('button', { name: /Añadir cargo/i }));
    fireEvent.change(screen.getByLabelText('Mes (cargo 2)'), { target: { value: '11' } });
    guardar();

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/importe/i);
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  it('dos cargos en el mismo mes tampoco se guardan', async () => {
    pintar();
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });
    escribirCargo(0, 6, '200', '15');
    fireEvent.click(screen.getByRole('button', { name: /Añadir cargo/i }));
    escribirCargo(1, 6, '120', '20');
    guardar();

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/mes/i);
    expect(mockActualizar).not.toHaveBeenCalled();
  });
});

// ─── reabrir sin destruir ───────────────────────────────────────────────────

describe('reabrir un gasto que ya va por cargos', () => {
  const ibi = () => compromiso({ importe: IBI_PORPAGO, patron: IBI_PATRON });

  it('se abre en su modo, no en «Fijo»', () => {
    pintar(ibi());
    expect(modoImporte().value).toBe('porPago');
  });

  it('con sus dos cargos, sus importes y SUS días', () => {
    pintar(ibi());
    expect((screen.getByLabelText('Mes (cargo 1)') as HTMLSelectElement).value).toBe('6');
    expect(campo('Importe (cargo 1)').value).toBe('200');
    expect(campo('Día (cargo 1)').value).toBe('15');
    expect((screen.getByLabelText('Mes (cargo 2)') as HTMLSelectElement).value).toBe('11');
    expect(campo('Importe (cargo 2)').value).toBe('120');
    expect(campo('Día (cargo 2)').value).toBe('11');
  });

  // La regresión que este PR viene a evitar: tocar cualquier otra cosa del
  // gasto no puede llevarse por delante sus cargos.
  it('cambiar la cuenta de cargo y guardar los deja intactos', async () => {
    pintar(ibi());
    fireEvent.change(cuentaCargo(), { target: { value: '2' } });
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().cuentaCargo).toBe(2);
    expect(patchGuardado().importe).toEqual(IBI_PORPAGO);
    expect(patchGuardado().patron).toEqual(IBI_PATRON);
  });

  it('se puede quitar un cargo', async () => {
    pintar(ibi());
    fireEvent.click(screen.getAllByRole('button', { name: /Quitar cargo/i })[1]);
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({ modo: 'porPago', importesPorPago: { 6: 200 } });
    expect(patchGuardado().patron.mesesPago).toEqual([6]);
  });
});

// ─── lo que la ficha no sabe representar, no lo pisa ────────────────────────

describe('un `diferenciadoPorMes` de la detección automática', () => {
  const detectado = () =>
    compromiso({
      importe: { modo: 'diferenciadoPorMes', importesPorMes: [0, 0, 0, 0, 0, 200, 0, 0, 0, 0, 120, 0] },
      patron: { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 3 },
    });

  it('no se abre disfrazado de «Fijo»', () => {
    pintar(detectado());
    expect(modoImporte().value).not.toBe('fijo');
  });

  // Antes: modo «Fijo», importe vacío, y al guardar `{modo:'fijo', importe:0}`.
  it('guardar sin tocarlo lo deja EXACTAMENTE igual', async () => {
    pintar(detectado());
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({
      modo: 'diferenciadoPorMes',
      importesPorMes: [0, 0, 0, 0, 0, 200, 0, 0, 0, 0, 120, 0],
    });
  });

  it('cambiar la cuenta tampoco se lo lleva por delante', async () => {
    pintar(detectado());
    fireEvent.change(cuentaCargo(), { target: { value: '2' } });
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().cuentaCargo).toBe(2);
    expect(patchGuardado().importe.modo).toBe('diferenciadoPorMes');
  });

  // Pasarlo a cargos SÍ se puede · pero eligiéndolo, no de rebote. Y llega
  // relleno con lo que la detección averiguó.
  it('pasarlo a cargos es un acto explícito · y llega relleno', async () => {
    pintar(detectado());
    fireEvent.change(modoImporte(), { target: { value: 'porPago' } });

    expect(campo('Importe (cargo 1)').value).toBe('200');
    expect(campo('Importe (cargo 2)').value).toBe('120');
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({ modo: 'porPago', importesPorPago: { 6: 200, 11: 120 } });
  });
});

// ─── los modos de siempre siguen igual ──────────────────────────────────────

describe('lo que ya funcionaba', () => {
  it('un gasto fijo se sigue guardando fijo', async () => {
    pintar(compromiso({ importe: { modo: 'fijo', importe: 60 } }));
    expect(modoImporte().value).toBe('fijo');
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({ modo: 'fijo', importe: 60 });
  });

  it('y uno por tramos, por tramos', async () => {
    pintar(compromiso({ importe: { modo: 'porTramos', tramos: [{ desde: '2026-06-01', importe: 38 }] } }));
    expect(modoImporte().value).toBe('porTramos');
    guardar();

    await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
    expect(patchGuardado().importe).toEqual({ modo: 'porTramos', tramos: [{ desde: '2026-06-01', importe: 38 }] });
  });
});
