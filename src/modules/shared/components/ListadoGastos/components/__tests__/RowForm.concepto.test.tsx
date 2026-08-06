// Cambiar QUÉ es un gasto desde la ficha de edición.
//
// Lo que vigila: que la ventana de editar pueda arreglar la clasificación. No
// podía. Mostraba importe, cuenta y calendario, pero ni enseñaba ni guardaba la
// clasificación, así que un gasto mal clasificado se quedaba mal clasificado
// por mucho que lo abrieras — que es exactamente lo que le pasaba al seguro de
// vida de ING: ámbito personal, familia `seguros` (que no existe en el catálogo
// personal) y categoría de inmueble.

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
    categoria: 'inmueble.seguros',
    bolsaPresupuesto: 'necesidades',
    tipo: 'otros',
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
  it('un registro ya migrado enseña su concepto', () => {
    pintar(compromiso({ concepto: 'seguro_vida' }));
    expect(selectConOpcion('Seguro vida').value).toBe('seguro_vida');
  });

  it('uno sin migrar se traduce de su par legacy', () => {
    // `seguros:vida` se retiró del catálogo pero sigue en los datos.
    pintar(compromiso({ tipoFamilia: 'seguros', subtipo: 'vida' }));
    expect(selectConOpcion('Seguro vida').value).toBe('seguro_vida');
  });

  it('uno que no se sabe traducir se abre «Sin clasificar», no en algo inventado', () => {
    pintar(compromiso({ tipoFamilia: undefined, subtipo: undefined }));
    const select = selectConOpcion('— Sin clasificar —');
    expect(select.value).toBe('');
  });
});

describe('sólo se ofrece lo que sabe clasificarse en este ámbito', () => {
  it('en personal no aparecen las familias que son sólo de inmueble', () => {
    pintar(compromiso({ concepto: 'seguro_vida' }));
    const fam = selectConOpcion('Seguros');
    expect(opcionesDe(fam)).toContain('Suministros');
    expect(opcionesDe(fam)).toContain('Día a día');
    expect(opcionesDe(fam)).not.toContain('Servicios y explotación');
    expect(opcionesDe(fam)).not.toContain('Mobiliario y enseres');
  });

  it('en inmueble no aparecen las de sólo personal', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'ibi' }));
    const fam = selectConOpcion('Tributos');
    expect(opcionesDe(fam)).toContain('Servicios y explotación');
    expect(opcionesDe(fam)).not.toContain('Suscripciones');
    expect(opcionesDe(fam)).not.toContain('Cuotas');
  });

  it('dentro de una familia sólo salen sus conceptos de este ámbito', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'seguro_hogar' }));
    const conceptos = selectConOpcion('Seguro hogar');
    // `seguro_salud` y `seguro_coche` son de la misma familia pero sólo personal.
    expect(opcionesDe(conceptos)).toContain('Impago');
    expect(opcionesDe(conceptos)).not.toContain('Seguro salud');
    expect(opcionesDe(conceptos)).not.toContain('Seguro coche');
  });
});

describe('al guardar, la clasificación se deriva del concepto', () => {
  it('el seguro de vida de ING sale con la categoría de SU ámbito', async () => {
    pintar(compromiso({ tipoFamilia: 'seguros', subtipo: 'vida' }));

    const payload = await guardar();

    expect(payload.concepto).toBe('seguro_vida');
    // Entra con `inmueble.seguros` en un gasto personal y sale con la suya.
    expect(payload.categoria).toBe('salud');
    expect(payload.tipo).toBe('seguro');
    expect(payload.bolsaPresupuesto).toBe('necesidades');
  });

  it('cambiar el concepto cambia categoría, tipo y bolsa a la vez', async () => {
    pintar(compromiso({ concepto: 'seguro_vida' }));

    fireEvent.change(selectConOpcion('Seguros'), { target: { value: 'suscripciones' } });
    fireEvent.change(selectConOpcion('Streaming'), { target: { value: 'musica' } });
    const payload = await guardar();

    expect(payload.concepto).toBe('musica');
    expect(payload.categoria).toBe('suscripciones');
    expect(payload.bolsaPresupuesto).toBe('deseos');
    expect(payload.tipo).toBe('suscripcion');
  });

  it('un gasto de inmueble no se lleva bolsa del 50/30/20', async () => {
    pintar(
      compromiso({
        ambito: 'inmueble',
        inmuebleId: 3,
        concepto: 'ibi',
        bolsaPresupuesto: 'necesidades',
      }),
    );

    const payload = await guardar();

    expect(payload.categoria).toBe('inmueble.ibi');
    expect(payload.bolsaPresupuesto).toBe('inmueble');
  });

  it('sin clasificar no se inventa nada · se guarda el resto y la clasificación se queda como estaba', async () => {
    pintar(compromiso({ tipoFamilia: undefined, subtipo: undefined }));

    const payload = await guardar();

    expect(payload.concepto).toBeUndefined();
    expect(payload.categoria).toBeUndefined();
    expect(payload.alias).toBe('Vida');
  });
});

describe('cambiar de familia no deja restos del concepto anterior', () => {
  it('el concepto salta al primero de la familia nueva', () => {
    pintar(compromiso({ concepto: 'seguro_vida' }));

    fireEvent.change(selectConOpcion('Seguros'), { target: { value: 'dia_a_dia' } });

    // Ya no puede seguir seleccionado un seguro dentro de «Día a día».
    expect(selectConOpcion('Supermercado · alimentación').value).toBe('supermercado');
  });

  it('la elección fiscal manual del concepto viejo no se arrastra', async () => {
    // Un seguro de vida vinculado a hipoteca guarda `intereses_financiacion`.
    // Si luego se convierte en otra cosa, esa elección ya no es de este gasto.
    pintar(
      compromiso({ concepto: 'seguro_vida', familiaFiscalManual: 'intereses_financiacion' }),
    );

    fireEvent.change(selectConOpcion('Seguros'), { target: { value: 'suscripciones' } });
    const payload = await guardar();

    expect(payload.familiaFiscalManual).toBeUndefined();
  });
});

describe('la frase fiscal habla del concepto elegido AHORA', () => {
  it('cambia antes de guardar, no después', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'seguro_hogar' }));
    // `getByText` ya falla si no está · no hace falta afirmarlo dos veces.
    screen.getByText(/cuenta como seguros · deducible/i);

    fireEvent.change(selectConOpcion('Seguros'), { target: { value: 'mobiliario' } });

    // Mobiliario no se resta: se amortiza al 10 % (casilla 0117).
    screen.getByText(/se amortiza al 10 %/i);
  });

  it('la derrama sigue preguntando · lo dice el acta, no el catálogo', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'derrama' }));
    screen.getByText(/¿conservación o mejora\?/i);
  });
});
