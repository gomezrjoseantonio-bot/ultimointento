// Cambiar QUÉ es un gasto desde la ficha de edición.
//
// Lo que vigila: que la ventana de editar pueda arreglar la clasificación. No
// podía. Mostraba importe, cuenta y calendario, pero ni enseñaba ni guardaba la
// clasificación, así que un gasto mal clasificado se quedaba mal clasificado
// por mucho que lo abrieras. Con el catálogo único (E2.4.1c) la clasificación
// es familia + subtipo, y la fiscalidad la pone la lente al leer, no la ficha.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RowForm from '../RowForm';
import type { Account } from '../../../../../../services/db';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const mockActualizar = jest.fn();

jest.mock('../../../../../../services/personal/compromisosRecurrentesService', () => ({
  actualizarCompromiso: (...a: unknown[]) => mockActualizar(...a),
}));
jest.mock('../../../../../../services/tarjetasService', () => ({
  listarTarjetas: () => Promise.resolve([]),
}));
jest.mock('../../../../../../design-system/v5', () => ({ showToastV5: jest.fn() }));

const CUENTAS = [{ id: 1, alias: 'ING', tipo: 'CORRIENTE' }] as Account[];

const compromiso = (over: Partial<CompromisoRecurrente> = {}) =>
  ({
    id: 15,
    alias: 'Vida',
    proveedor: { nombre: 'ING' },
    patron: { tipo: 'mensualDiaFijo', dia: 15 },
    importe: { modo: 'fijo', importe: 39.86 },
    cuentaCargo: 1,
    conceptoBancario: 'ING SEGURO VIDA',
    metodoPago: 'domiciliacion',
    familia: 'seguros_alarmas',
    subtipo: 'vida',
    responsable: 'titular',
    ambito: 'personal',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente & { id: number };

const pintar = (c = compromiso()) =>
  render(<RowForm compromiso={c} accounts={CUENTAS} onSaved={jest.fn()} />);

// `Field` pinta la etiqueta sin `for`, así que se busca el desplegable por una
// de sus opciones, que es lo que de verdad lo identifica.
const selectConOpcion = (texto: string): HTMLSelectElement => {
  const opcion = screen.getAllByRole('option').find((o) => o.textContent === texto);
  if (!opcion) throw new Error(`No hay ningún desplegable con la opción "${texto}"`);
  return opcion.closest('select') as HTMLSelectElement;
};
const opcionesDe = (s: HTMLSelectElement) =>
  Array.from(s.querySelectorAll('option')).map((o) => o.textContent);
/** El desplegable de FAMILIA · se identifica por una familia de ambos ámbitos. */
const selectFamilia = () => selectConOpcion('Seguros y alarmas');

const guardar = async () => {
  fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
  await waitFor(() => expect(mockActualizar).toHaveBeenCalled());
  return mockActualizar.mock.calls[0][1] as Partial<CompromisoRecurrente>;
};

beforeEach(() => {
  mockActualizar.mockReset();
  mockActualizar.mockImplementation(async (_id, patch) => ({ ...compromiso(), ...patch }));
});

describe('la ficha nace sabiendo qué es el gasto', () => {
  it('un registro clasificado enseña su familia y su subtipo', () => {
    pintar(compromiso());
    expect(selectFamilia().value).toBe('seguros_alarmas');
    expect(selectConOpcion('— Sin concretar —').value).toBe('vida');
  });

  it('uno sin familia se abre «Sin clasificar», no en algo inventado', () => {
    pintar(compromiso({ familia: undefined, subtipo: undefined }));
    const select = selectConOpcion('— Sin clasificar —');
    expect(select.value).toBe('');
  });

  it('el subtipo sólo se ofrece cuando la familia lo tiene', () => {
    pintar(compromiso({ familia: 'supermercado', subtipo: undefined }));
    expect(screen.queryByText('— Sin concretar —')).toBeNull();
  });
});

describe('sólo se sugiere lo que encaja en este ámbito', () => {
  it('en personal no aparecen las familias que son sólo de inmueble · y sí las suyas', () => {
    pintar(compromiso());
    const sel = selectFamilia();
    expect(opcionesDe(sel)).toContain('Suministro');
    expect(opcionesDe(sel)).toContain('Suscripciones');
    expect(opcionesDe(sel)).toContain('Supermercado');
  });

  it('en inmueble no aparecen las de sólo personal', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, familia: 'impuestos_tasas', subtipo: 'ibi' }));
    const sel = selectFamilia();
    expect(opcionesDe(sel)).toContain('Gestión');
    expect(opcionesDe(sel)).toContain('Reforma y mejora');
    expect(opcionesDe(sel)).not.toContain('Suscripciones');
    expect(opcionesDe(sel)).not.toContain('Supermercado');
  });

  it('una familia guardada que el ámbito no sugiere se sigue enseñando · no se pierde', () => {
    // El ámbito sugiere, no valida (DEFINITIVO · principio 4).
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, familia: 'suscripciones', subtipo: 'musica' }));
    expect(selectFamilia().value).toBe('suscripciones');
  });
});

describe('al guardar se guarda familia + subtipo · nada más se deriva', () => {
  it('el seguro de vida de ING sale como seguros_alarmas · vida', async () => {
    pintar(compromiso());

    const payload = await guardar();

    expect(payload.familia).toBe('seguros_alarmas');
    expect(payload.subtipo).toBe('vida');
    expect('categoria' in payload).toBe(false);
    expect('bolsaPresupuesto' in payload).toBe(false);
    expect('tipo' in payload).toBe(false);
  });

  it('cambiar de familia borra el subtipo anterior · no se arrastra', async () => {
    pintar(compromiso());

    fireEvent.change(selectFamilia(), { target: { value: 'suscripciones' } });
    const payload = await guardar();

    expect(payload.familia).toBe('suscripciones');
    expect(payload.subtipo).toBeUndefined();
  });

  it('concretar el subtipo de la nueva familia lo guarda', async () => {
    pintar(compromiso());

    fireEvent.change(selectFamilia(), { target: { value: 'suscripciones' } });
    fireEvent.change(selectConOpcion('— Sin concretar —'), { target: { value: 'musica' } });
    const payload = await guardar();

    expect(payload).toMatchObject({ familia: 'suscripciones', subtipo: 'musica' });
  });

  it('un gasto de inmueble no se lleva casilla en el compromiso · la pone la lente al leer', async () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, familia: 'impuestos_tasas', subtipo: 'ibi' }));

    const payload = await guardar();

    expect(payload).toMatchObject({ familia: 'impuestos_tasas', subtipo: 'ibi' });
    expect('casillaAEAT' in payload).toBe(false);
    expect('familiaFiscalManual' in payload).toBe(false);
  });

  it('sin clasificar no se inventa nada · se guarda el resto y la clasificación se queda como estaba', async () => {
    pintar(compromiso({ familia: undefined, subtipo: undefined }));

    const payload = await guardar();

    expect(payload.familia).toBeUndefined();
    expect(payload.subtipo).toBeUndefined();
    expect(payload.alias).toBe('Vida');
  });
});

describe('la frase fiscal habla de la familia elegida AHORA', () => {
  it('cambia antes de guardar, no después', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, familia: 'seguros_alarmas', subtipo: 'hogar' }));
    // `getByText` ya falla si no está · no hace falta afirmarlo dos veces.
    screen.getByText(/cuenta como seguros · deducible/i);

    fireEvent.change(selectFamilia(), { target: { value: 'mobiliario_enseres' } });

    // Mobiliario no se resta: se amortiza al 10 % (casilla 0117).
    screen.getByText(/se amortiza al 10 %/i);
  });

  it('la reforma es mejora · se amortiza al 3 %', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, familia: 'reforma_mejora', subtipo: undefined }));
    screen.getByText(/cuenta como mejora · no se resta · se amortiza al 3 %/i);
  });

  it('un gasto personal no deduce · y lo dice', () => {
    pintar(compromiso());
    screen.getByText(/gasto personal · no deducible/i);
  });
});

describe('la ficha no repite lo mismo cuatro veces', () => {
  it('el nombre sale VACÍO cuando repite al concepto · con él de marcador', () => {
    pintar(compromiso({ subtipo: undefined, alias: 'Seguros y alarmas' }));
    const nombre = screen.getByPlaceholderText('Seguros y alarmas') as HTMLInputElement;
    expect(nombre.value).toBe('');
  });

  it('un nombre que SÍ distingue se enseña', () => {
    pintar(compromiso({ alias: 'Vida de Ana' }));
    expect((screen.getByDisplayValue('Vida de Ana') as HTMLInputElement).value).toBe('Vida de Ana');
  });

  it('sin proveedor no se inventa uno con el nombre del gasto', async () => {
    // Guardaba `proveedor.nombre = alias`, así que la lista enseñaba
    // «Alquiler» debajo de «Alquiler» como si lo cobrara alguien así llamado.
    pintar(compromiso({ familia: 'alquiler_renting', subtipo: 'vivienda', alias: 'Alquiler', proveedor: { nombre: '' } }));

    const payload = await guardar();

    expect(payload.proveedor?.nombre).toBe('');
  });
});

describe('el nombre en blanco cae al concepto', () => {
  const luz = (over: Partial<CompromisoRecurrente> = {}) =>
    compromiso({ familia: 'suministro', subtipo: 'luz', ...over });

  it('borrarlo guarda el nombre del concepto, no el del proveedor', async () => {
    // El campo se enseña vacío a propósito cuando no añade nada, así que
    // dejarlo así es lo normal. Caer al proveedor renombraba el gasto a
    // «Iberdrola»; sin proveedor lo dejaba en «Gasto recurrente».
    pintar(luz({ alias: 'Luz', proveedor: { nombre: 'Iberdrola' } }));

    fireEvent.change(screen.getByPlaceholderText('Suministro · Luz'), { target: { value: '' } });
    const payload = await guardar();

    expect(payload.alias).toBe('Suministro · Luz');
  });

  it('un gasto recién creado tampoco se queda en «Gasto recurrente»', async () => {
    pintar(luz({ alias: 'Nuevo gasto', proveedor: { nombre: '' } }));

    const payload = await guardar();

    expect(payload.alias).toBe('Suministro · Luz');
  });

  it('un nombre escrito manda sobre todo lo demás', async () => {
    pintar(luz({ alias: 'Luz del garaje' }));

    const payload = await guardar();

    expect(payload.alias).toBe('Luz del garaje');
  });
});
