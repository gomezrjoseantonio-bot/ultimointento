// Ficha de movimiento (§4.5).
//
// Lo que fija, por orden de importancia:
//   · que NUNCA se le pida al usuario elegir "categoría fiscal" · él ve
//     familia/subtipo del catálogo único y la casilla la pone la lente al leer;
//   · que una reforma en un inmueble NO se guarde como gasto (es mejora);
//   · que la transferencia no arrastre clasificación fiscal;
//   · que el formulario nazca relleno con la clasificación automática.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import FichaMovimiento, { parseImporte } from '../FichaMovimiento';
import type { Account } from '../../../../services/db';

const cuenta = (id: number, alias: string): Account => ({
  id,
  iban: `ES910049150005123456789${id}`,
  alias,
  ultimosCuatro: `789${id}`,
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
});

const base = {
  abierta: true,
  cuentas: [cuenta(1, 'Sabadell'), cuenta(2, 'Santander')],
  inmuebles: [{ id: 7, alias: 'Tenderina 64' }],
  onCerrar: jest.fn(),
  onGuardar: jest.fn(),
};

const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

describe('el usuario nunca elige categoría fiscal', () => {
  it('enseña familia y concepto, y no menciona casillas ni categorías fiscales', () => {
    render(<FichaMovimiento {...base} />);

    expect(screen.getByLabelText('Familia')).toBeInTheDocument();
    expect(screen.getByLabelText('Concepto del gasto')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
    // El mapeo a Hacienda es responsabilidad de ATLAS, no del usuario (§4.5).
    expect(screen.queryByText(/categor[íi]a fiscal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/casilla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/categoryKey/i)).not.toBeInTheDocument();
  });

  it('un gasto DE INMUEBLE guarda familia + subtipo del catálogo · la casilla no viaja', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);

    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministro' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '74,09' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'suministro', subtipoPersistir: 'luz', inmuebleId: 7 })
    );
    expect('casillaAEAT' in onGuardar.mock.calls[0][0]).toBe(false);
  });

  it('el MISMO concepto, sin inmueble, es un gasto personal con la MISMA familia', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);

    // Sin inmueble → ámbito personal. La familia es la misma del catálogo único:
    // que no se declare lo decide la lente por el ámbito, no otra clasificación.
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministro' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '74,09' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'suministro', subtipoPersistir: 'luz', inmuebleId: null })
    );
  });

  it('el gasto PERSONAL sugiere familias que a un inmueble no se le ofrecen', () => {
    render(<FichaMovimiento {...base} />);
    const familia = screen.getByLabelText('Familia');
    expect(familia).toHaveTextContent('Alquiler y renting');
    expect(familia).toHaveTextContent('Suscripciones');
    expect(familia).toHaveTextContent('Supermercado');

    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    expect(screen.getByLabelText('Familia')).not.toHaveTextContent('Supermercado');
    expect(screen.getByLabelText('Familia')).toHaveTextContent('Gestión');
  });

  it('cambiar de familia deja el subtipo sin concretar · es opcional', () => {
    render(<FichaMovimiento {...base} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministro' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });

    const concepto = screen.getByLabelText('Concepto del gasto') as HTMLSelectElement;
    expect(concepto.value).toBe('');
  });

  it('una familia sin subtipos no enseña el selector de concepto', () => {
    render(<FichaMovimiento {...base} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'supermercado' } });
    expect(screen.queryByLabelText('Concepto del gasto')).not.toBeInTheDocument();
  });
});

describe('el ingreso NO usa el catálogo de gasto', () => {
  it('muestra conceptos de ingreso, no familias de gasto', () => {
    render(<FichaMovimiento {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ingreso' }));

    expect(screen.queryByLabelText('Familia')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Concepto del gasto')).not.toBeInTheDocument();
    const concepto = screen.getByLabelText('Concepto del ingreso');
    expect(concepto).toHaveTextContent('Alquiler');
    expect(concepto).toHaveTextContent('Otros ingresos');
  });

  it('guarda la key de ingreso, nunca una de gasto', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ingreso' }));
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '1200' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'ingreso', familia: 'otros_ingresos', importe: 1200 })
    );
  });

  it('el alquiler exige inmueble · bloquea guardar hasta ponerlo', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ingreso' }));
    fireEvent.change(screen.getByLabelText('Concepto del ingreso'), { target: { value: 'alquiler' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '395' } });
    guardar();

    // Sin inmueble no se guarda, y lo dice.
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('El alquiler necesita un inmueble')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    guardar();
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'ingreso', familia: 'alquiler', inmuebleId: 7 })
    );
  });
});

describe('la reforma · una familia, no una pregunta', () => {
  // Elegir «Reforma y mejora» en un inmueble ES decir que se capitaliza. No hay
  // pregunta aparte: la lente decide por familia + ámbito (E2.4.1c).
  const elegirReforma = () => {
    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'reforma_mejora' } });
  };

  it('no avisa con familias normales', () => {
    render(<FichaMovimiento {...base} />);
    expect(screen.queryByText(/se suma al valor del inmueble/)).not.toBeInTheDocument();
    expect(screen.queryByText('¿Conservación o mejora?')).not.toBeInTheDocument();
  });

  it('una reforma personal (sin inmueble) NO es mejora · es un gasto más', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'reforma_mejora' } });
    expect(screen.queryByText(/se suma al valor del inmueble/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    guardar();
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'reforma_mejora', esMejora: false })
    );
  });

  it('en un inmueble avisa de que se amortiza · y no bloquea guardar', () => {
    render(<FichaMovimiento {...base} />);
    elegirReforma();

    expect(screen.getByText(/se suma al valor del inmueble/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });

  it('una derrama de comunidad sigue siendo gasto · conservación', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'derrama' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'comunidad', subtipoPersistir: 'derrama', esMejora: false })
    );
  });

  it('la reforma de un inmueble NO se guarda como gasto: se capitaliza y amortiza', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    elegirReforma();
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    guardar();

    // Va a `mejorasInmueble` · lo decide la lente por la familia.
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'reforma_mejora', esMejora: true })
    );
  });

  it('cambiar de familia olvida que era mejora', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    elegirReforma();
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ esMejora: false }));
  });
});

describe('transferencia', () => {
  const aTransferencia = () => fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }));

  it('oculta familia, concepto e inmueble · no es gasto fiscal', () => {
    render(<FichaMovimiento {...base} />);
    aTransferencia();

    expect(screen.queryByLabelText('Familia')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Concepto del gasto')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Inmueble')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta destino')).toBeInTheDocument();
  });

  it('no ofrece como destino la misma cuenta de origen', () => {
    render(<FichaMovimiento {...base} />);
    aTransferencia();

    const destino = screen.getByLabelText('Cuenta destino');
    expect(destino).not.toHaveTextContent('Sabadell');
    expect(destino).toHaveTextContent('Santander');
  });

  it('permite destino externo', () => {
    render(<FichaMovimiento {...base} />);
    aTransferencia();
    expect(screen.getByLabelText('Cuenta destino')).toHaveTextContent('Externa');
  });

  it('guarda sin clasificación fiscal', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    aTransferencia();
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '500' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'transferencia', familiaPersistir: null, subtipoPersistir: null, inmuebleId: null })
    );
  });
});

describe('alta y edición', () => {
  it('en alta se elige tipo; al editar ya está decidido', () => {
    const { unmount } = render(<FichaMovimiento {...base} />);
    expect(screen.getByRole('button', { name: 'Gasto' })).toBeInTheDocument();
    expect(screen.getByText('Anotar movimiento')).toBeInTheDocument();
    unmount();

    render(<FichaMovimiento {...base} inicial={{ tipo: 'gasto', concepto: 'Luz' }} />);
    expect(screen.queryByRole('button', { name: 'Gasto' })).not.toBeInTheDocument();
    expect(screen.getByText('Editar previsión')).toBeInTheDocument();
  });

  it('nace relleno con la clasificación automática · el usuario solo corrige', () => {
    render(
      <FichaMovimiento
        {...base}
        inicial={{
          tipo: 'gasto',
          concepto: 'Recibo Iberdrola',
          importe: -74.09,
          familia: 'suministro',
          subtipo: 'luz',
          inmuebleId: 7,
        }}
      />
    );

    expect(screen.getByLabelText('Descripción')).toHaveValue('Recibo Iberdrola');
    expect(screen.getByLabelText('Familia')).toHaveValue('suministro');
    expect(screen.getByLabelText('Concepto del gasto')).toHaveValue('luz');
    expect(screen.getByLabelText('Importe real')).toHaveValue('74,09');
    expect(screen.getByLabelText('Inmueble')).toHaveValue('7');
  });

  it('muestra el previsto como hint al editar', () => {
    render(<FichaMovimiento {...base} inicial={{ concepto: 'x' }} importePrevisto={-74.09} />);
    expect(screen.getByText('previsto −74,09 €')).toBeInTheDocument();
  });

  it('Eliminar solo existe en edición', () => {
    const { unmount } = render(<FichaMovimiento {...base} onEliminar={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    unmount();

    render(<FichaMovimiento {...base} inicial={{ concepto: 'x' }} onEliminar={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('NO tiene campo de documento · la factura vive en el Archivo', () => {
    render(<FichaMovimiento {...base} />);
    expect(screen.queryByLabelText(/factura|documento|justificante/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjuntar/i })).not.toBeInTheDocument();
  });
});

// Si la ficha no sabe cómo está clasificado el registro, NO puede inventarlo:
// nacería con la primera familia del catálogo y guardar reclasificaría a
// espaldas del usuario, que no tocó nada.
describe('no reclasifica a espaldas del usuario', () => {
  it('al editar sin clasificación conocida abre Sin clasificar', () => {
    render(<FichaMovimiento {...base} inicial={{ tipo: 'gasto', concepto: 'Cargo raro' }} />);

    expect(screen.getByLabelText('Familia')).toHaveValue('');
    expect(screen.getByText('Sin clasificar')).toBeInTheDocument();
    // Sin familia elegida, el concepto no tiene nada que ofrecer.
    expect(screen.queryByLabelText('Concepto del gasto')).not.toBeInTheDocument();
  });

  it('y guarda sin tocar la clasificación · familia undefined, no null', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento {...base} inicial={{ tipo: 'gasto', concepto: 'x' }} onGuardar={onGuardar} />
    );
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    const v = onGuardar.mock.calls[0][0];
    expect(v.familiaPersistir).toBeUndefined();
    expect(v.subtipoPersistir).toBeUndefined();
  });

  it('en cambio en ALTA sí parte de una familia · ahí no hay nada que preservar', () => {
    render(<FichaMovimiento {...base} />);
    expect(screen.getByLabelText('Familia')).not.toHaveValue('');
  });

  it('si el usuario elige familia, esa sí se guarda', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento
        {...base}
        inicial={{ tipo: 'gasto', concepto: 'x', inmuebleId: 7 }}
        onGuardar={onGuardar}
      />
    );
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'impuestos_tasas' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'ibi' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ familiaPersistir: 'impuestos_tasas', subtipoPersistir: 'ibi' })
    );
  });

  it('reclasificar sin concretar subtipo manda subtipo null · borra el viejo', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento
        {...base}
        inicial={{ tipo: 'gasto', concepto: 'x', inmuebleId: 7, familia: 'suministro', subtipo: 'luz' }}
        onGuardar={onGuardar}
      />
    );
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'impuestos_tasas' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    // `null` y no `undefined`: undefined sería "no toques" y dejaría pegado el
    // subtipo de la clasificación anterior.
    expect(onGuardar.mock.calls[0][0].subtipoPersistir).toBeNull();
  });

  it('un guardado que falla no deja la promesa suelta', async () => {
    const onGuardar = jest.fn().mockRejectedValue(new Error('IndexedDB caída'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    await Promise.resolve();
    expect(error).toHaveBeenCalledWith('[FichaMovimiento] el guardado falló', expect.any(Error));
    error.mockRestore();
  });
});

describe('importe', () => {
  it('el signo lo marca el tipo, no lo que teclee el usuario', () => {
    const onGuardar = jest.fn();
    const { unmount } = render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '100' } });
    guardar();
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ importe: -100 }));
    unmount();

    const onGuardar2 = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ingreso' }));
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '100' } });
    guardar();
    expect(onGuardar2).toHaveBeenCalledWith(expect.objectContaining({ importe: 100 }));
  });

  it('no guarda sin importe válido, y lo dice', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    guardar();

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText(/importe mayor que cero/i)).toBeInTheDocument();
  });

  it('acepta coma y punto decimal, y el símbolo de euro', () => {
    expect(parseImporte('74,09')).toBeCloseTo(74.09);
    expect(parseImporte('74.09')).toBeCloseTo(74.09);
    expect(parseImporte('1.234,50 €')).toBeCloseTo(1234.5);
    expect(parseImporte('')).toBeNull();
    expect(parseImporte('abc')).toBeNull();
  });
});

describe('cierre', () => {
  it('cerrada no renderiza nada', () => {
    const { container } = render(<FichaMovimiento {...base} abierta={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('el aspa, Cancelar y el fondo cierran', () => {
    const onCerrar = jest.fn();
    const { container } = render(<FichaMovimiento {...base} onCerrar={onCerrar} />);

    fireEvent.click(screen.getByLabelText('Cerrar'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(container.querySelector('.back')!);
    expect(onCerrar).toHaveBeenCalledTimes(3);
  });
});


// §7 · el enlace al documento del Archivo.
describe('el papel que respalda el movimiento', () => {
  const abrir = jest.fn();

  beforeEach(() => abrir.mockClear());

  const conDocs = (documentIds?: number[]) =>
    render(
      <FichaMovimiento
        abierta
        inicial={{ tipo: 'gasto', concepto: 'Seguro', importe: -40, fecha: '2026-08-10', cuentaId: 1 }}
        cuentas={[{ id: 1, alias: 'Santander' } as never]}
        inmuebles={[]}
        onCerrar={() => {}}
        onGuardar={() => {}}
        documentIds={documentIds}
        onAbrirDocumento={abrir}
      />
    );

  it('sin documentos NO se pinta nada · no hay papel que ver', () => {
    conDocs(undefined);
    expect(screen.queryByText(/Ver el documento/)).not.toBeInTheDocument();
  });

  it('con uno, enlaza a ese', () => {
    conDocs([12]);
    fireEvent.click(screen.getByText('Ver el documento'));
    expect(abrir).toHaveBeenCalledWith(12);
  });

  it('con varios lo dice · el usuario sabe que hay más de uno antes de ir', () => {
    conDocs([12, 13, 14]);
    expect(screen.getByText('Ver el documento (hay 3)')).toBeInTheDocument();
  });

  it('es un enlace, NO una zona de subida · aquí se corrigen importes', () => {
    conDocs([12]);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});


// Sacar del cajero no es un gasto: el dinero no se va, cambia de sitio. Sin
// esto, sacar 200 € hundía el patrimonio 200 € el mismo día.
describe('el atajo del cajero', () => {
  const efectivo: Account = {
    id: 9,
    alias: 'Efectivo',
    tipo: 'EFECTIVO',
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
  } as Account;

  it('deja la retirada montada · transferencia interna a Efectivo', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento
        {...base}
        cuentas={[...base.cuentas, efectivo]}
        onGuardar={onGuardar}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cajero' }));
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '200' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'transferencia',
        cuentaDestinoId: 9,
        concepto: 'Retirada de cajero',
      })
    );
  });

  // Un botón que no puede hacer nada es peor que no ofrecerlo: se dice por qué.
  it('sin cuenta de efectivo, el botón no engaña', () => {
    render(<FichaMovimiento {...base} />);
    const cajero = screen.getByRole('button', { name: 'Cajero' });
    expect(cajero).toBeDisabled();
    expect(cajero).toHaveAttribute('title', expect.stringContaining('cuenta de Efectivo'));
  });

  // Salir del atajo no puede dejar el destino puesto: una transferencia normal
  // nacería apuntando a la cuenta de efectivo sin que nadie lo pidiera.
  it('cambiar de tipo suelta el destino que puso el atajo', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento {...base} cuentas={[...base.cuentas, efectivo]} onGuardar={onGuardar} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cajero' }));
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }));
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '50' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ cuentaDestinoId: null }));
  });
});

// § VOCABULARIO-dinero · un GASTO se paga de una forma · el método decide qué se
// pregunta (cuenta vs tarjeta), y solo se ofrece lo que HAY con qué pagar.
describe('el método de pago de un gasto', () => {
  const credito = { id: 20, alias: 'Carrefour', modalidad: 'credito' as const };
  const debito = { id: 21, alias: 'BBVA débito', modalidad: 'debito' as const };

  it('sin tarjetas no ofrece ni crédito ni débito · solo cuenta bancaria', () => {
    render(<FichaMovimiento {...base} />);
    const metodo = screen.getByLabelText('Método de pago');
    expect(metodo).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Tarjeta de crédito' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Tarjeta de débito' })).toBeNull();
  });

  it('con tarjeta de crédito pero SIN débito, no ofrece «Tarjeta de débito»', () => {
    render(<FichaMovimiento {...base} tarjetas={[credito]} />);
    expect(screen.getByRole('option', { name: 'Tarjeta de crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Tarjeta de débito' })).toBeNull();
  });

  it('al elegir Tarjeta de crédito desaparece la cuenta y se guarda con la tarjeta', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} tarjetas={[credito, debito]} onGuardar={onGuardar} />);

    // De cuenta bancaria a tarjeta de crédito.
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'tarjeta_credito' } });
    // Ya no se elige cuenta bancaria · la pone la tarjeta.
    expect(screen.queryByLabelText('Cuenta de cargo')).toBeNull();
    expect(screen.getByLabelText('Tarjeta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '30' } });
    guardar();
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ tarjetaId: 20 }));
  });
});
