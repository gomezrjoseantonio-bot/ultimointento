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
/** Las familias del selector de concepto · son `optgroup`, no opciones. */
const gruposDe = (s: HTMLSelectElement) =>
  Array.from(s.querySelectorAll('optgroup')).map((g) => g.getAttribute('label'));

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
    const sel = selectConOpcion('Seguro vida');
    expect(gruposDe(sel)).toContain('Suministros');
    expect(gruposDe(sel)).toContain('Día a día');
    expect(gruposDe(sel)).not.toContain('Servicios y explotación');
    expect(gruposDe(sel)).not.toContain('Mobiliario y enseres');
  });

  it('en inmueble no aparecen las de sólo personal', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'ibi' }));
    const sel = selectConOpcion('IBI');
    expect(gruposDe(sel)).toContain('Servicios y explotación');
    expect(gruposDe(sel)).not.toContain('Suscripciones');
    expect(gruposDe(sel)).not.toContain('Cuotas');
  });

  it('dentro de una familia sólo salen sus conceptos de este ámbito', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'seguro_hogar' }));
    const sel = selectConOpcion('Seguro hogar');
    // `seguro_salud` y `seguro_coche` son de la misma familia pero sólo personal.
    expect(opcionesDe(sel)).toContain('Impago');
    expect(opcionesDe(sel)).not.toContain('Seguro salud');
    expect(opcionesDe(sel)).not.toContain('Seguro coche');
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

    fireEvent.change(selectConOpcion('Seguro vida'), { target: { value: 'musica' } });
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

describe('cambiar de concepto no deja restos del anterior', () => {
  it('la elección fiscal manual del concepto viejo no se arrastra', async () => {
    // Un seguro de vida vinculado a hipoteca guarda `intereses_financiacion`.
    // Si luego se convierte en otra cosa, esa elección ya no es de este gasto.
    pintar(
      compromiso({ concepto: 'seguro_vida', familiaFiscalManual: 'intereses_financiacion' }),
    );

    fireEvent.change(selectConOpcion('Seguro vida'), { target: { value: 'musica' } });
    const payload = await guardar();

    expect(payload.familiaFiscalManual).toBeUndefined();
  });
});

describe('la frase fiscal habla del concepto elegido AHORA', () => {
  it('cambia antes de guardar, no después', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'seguro_hogar' }));
    // `getByText` ya falla si no está · no hace falta afirmarlo dos veces.
    screen.getByText(/cuenta como seguros · deducible/i);

    fireEvent.change(selectConOpcion('Seguro hogar'), { target: { value: 'muebles' } });

    // Mobiliario no se resta: se amortiza al 10 % (casilla 0117).
    screen.getByText(/se amortiza al 10 %/i);
  });

  it('la derrama sigue preguntando · lo dice el acta, no el catálogo', () => {
    pintar(compromiso({ ambito: 'inmueble', inmuebleId: 3, concepto: 'derrama' }));
    screen.getByText(/¿conservación o mejora\?/i);
  });
});

describe('los campos legacy no se quedan viejos', () => {
  it('cambiar de concepto reescribe tipoFamilia y subtipo', async () => {
    pintar(compromiso({ concepto: 'seguro_vida', tipoFamilia: 'seguros_cuotas', subtipo: 'seguro_vida' }));

    fireEvent.change(selectConOpcion('Seguro vida'), { target: { value: 'musica' } });
    const payload = await guardar();

    expect({ f: payload.tipoFamilia, s: payload.subtipo }).toEqual({
      f: 'suscripciones',
      s: 'musica',
    });
  });

  it('un concepto SIN par legacy los limpia en vez de dejar el anterior', async () => {
    // `alarma` en personal es una de las cinco combinaciones que estrena la
    // unificación · no tiene par. Dejar el del concepto viejo haría que la
    // lista lo siguiera agrupando bajo aquella familia.
    pintar(compromiso({ concepto: 'seguro_vida', tipoFamilia: 'seguros_cuotas', subtipo: 'seguro_vida' }));

    fireEvent.change(selectConOpcion('Seguro vida'), { target: { value: 'alarma' } });
    const payload = await guardar();

    expect(payload.concepto).toBe('alarma');
    expect('tipoFamilia' in payload).toBe(true);
    expect({ f: payload.tipoFamilia, s: payload.subtipo }).toEqual({
      f: undefined,
      s: undefined,
    });
  });
});

describe('la ficha no repite lo mismo cuatro veces', () => {
  it('familia y concepto son UN campo · la familia es la cabecera del grupo', () => {
    pintar(compromiso({ concepto: 'seguro_vida' }));
    // Un único desplegable de clasificación · «Seguros» es un `optgroup`, no
    // una opción de otro select.
    const select = selectConOpcion('Seguro vida');
    const grupos = Array.from(select.querySelectorAll('optgroup')).map((g) =>
      g.getAttribute('label'),
    );
    expect(grupos).toContain('Seguros');
    expect(grupos).toContain('Suministros');
    expect(opcionesDe(select)).not.toContain('Seguros');
  });

  it('el nombre sale VACÍO cuando repite al concepto · con él de marcador', () => {
    pintar(compromiso({ concepto: 'seguro_vida', alias: 'Seguro vida' }));
    const nombre = screen.getByPlaceholderText('Seguro vida') as HTMLInputElement;
    expect(nombre.value).toBe('');
  });

  it('un nombre que SÍ distingue se enseña', () => {
    pintar(compromiso({ concepto: 'seguro_vida', alias: 'Vida de Ana' }));
    expect((screen.getByDisplayValue('Vida de Ana') as HTMLInputElement).value).toBe('Vida de Ana');
  });

  it('sin proveedor no se inventa uno con el nombre del gasto', async () => {
    // Guardaba `proveedor.nombre = alias`, así que la lista enseñaba
    // «Alquiler» debajo de «Alquiler» como si lo cobrara alguien así llamado.
    pintar(compromiso({ concepto: 'alquiler_vivienda', alias: 'Alquiler', proveedor: { nombre: '' } }));

    const payload = await guardar();

    expect(payload.proveedor?.nombre).toBe('');
  });
});

describe('el nombre en blanco cae al concepto', () => {
  it('borrarlo guarda el nombre del concepto, no el del proveedor', async () => {
    // El campo se enseña vacío a propósito cuando no añade nada, así que
    // dejarlo así es lo normal. Caer al proveedor renombraba el gasto a
    // «Iberdrola»; sin proveedor lo dejaba en «Gasto recurrente».
    pintar(compromiso({ concepto: 'luz', alias: 'Luz', proveedor: { nombre: 'Iberdrola' } }));

    fireEvent.change(screen.getByPlaceholderText('Luz'), { target: { value: '' } });
    const payload = await guardar();

    expect(payload.alias).toBe('Luz');
  });

  it('un gasto recién creado tampoco se queda en «Gasto recurrente»', async () => {
    pintar(compromiso({ concepto: 'luz', alias: 'Nuevo gasto', proveedor: { nombre: '' } }));

    const payload = await guardar();

    expect(payload.alias).toBe('Luz');
  });

  it('un nombre escrito manda sobre todo lo demás', async () => {
    pintar(compromiso({ concepto: 'luz', alias: 'Luz del garaje' }));

    const payload = await guardar();

    expect(payload.alias).toBe('Luz del garaje');
  });
});
