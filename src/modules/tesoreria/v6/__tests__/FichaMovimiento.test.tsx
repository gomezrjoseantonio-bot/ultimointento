// Ficha de movimiento (§4.5).
//
// Lo que fija, por orden de importancia:
//   · que NUNCA se le pida al usuario elegir "categoría fiscal" · él ve
//     familia/concepto y ATLAS traduce a `categoryKey` por dentro;
//   · que la derrama pregunte, y que una mejora NO se guarde como gasto;
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
  it('enseña familia y concepto, y no menciona casillas ni categoryKey', () => {
    render(<FichaMovimiento {...base} />);

    expect(screen.getByLabelText('Familia')).toBeInTheDocument();
    expect(screen.getByLabelText('Concepto del gasto')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
    // El mapeo a Hacienda es responsabilidad de ATLAS, no del usuario (§4.5).
    expect(screen.queryByText(/categor[íi]a fiscal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/casilla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/categoryKey/i)).not.toBeInTheDocument();
  });

  it('un gasto DE INMUEBLE traduce a la key de inmueble (con casilla AEAT)', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);

    // El ámbito lo decide el inmueble: al elegirlo, las familias son las de inmueble.
    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministros' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '74,09' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'suministro_inmueble', subtypeKey: 'luz' })
    );
  });

  it('el MISMO concepto, sin inmueble, es un gasto personal (no se declara)', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);

    // Sin inmueble → ámbito personal → key de brocha gorda, sin casilla.
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'suministros' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'luz' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '74,09' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'gasto_personal_vivienda', subtypeKey: null })
    );
  });

  it('el gasto PERSONAL ofrece familias que el de inmueble no tiene', () => {
    render(<FichaMovimiento {...base} />);
    const familia = screen.getByLabelText('Familia');
    // Las cuatro personales que faltaban cuando la ficha usaba el catálogo de inmueble.
    expect(familia).toHaveTextContent('Alquiler');
    expect(familia).toHaveTextContent('Cuotas');
    expect(familia).toHaveTextContent('Suscripciones');
    expect(familia).toHaveTextContent('Día a día');
  });

  it('cambiar de familia reinicia el concepto a uno válido de esa familia', () => {
    render(<FichaMovimiento {...base} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });

    const concepto = screen.getByLabelText('Concepto del gasto') as HTMLSelectElement;
    expect(concepto.value).toBe('comunidad_ordinaria');
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
      expect.objectContaining({ tipo: 'ingreso', categoryKey: 'otros_ingresos', importe: 1200 })
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
      expect.objectContaining({ tipo: 'ingreso', categoryKey: 'alquiler', inmuebleId: 7 })
    );
  });
});

describe('la derrama · única pregunta fiscal de la ficha', () => {
  // La derrama solo pregunta en ámbito INMUEBLE: en personal es un gasto más.
  const elegirDerrama = () => {
    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'derrama' } });
  };

  it('no aparece con conceptos normales', () => {
    render(<FichaMovimiento {...base} />);
    expect(screen.queryByText('¿Conservación o mejora?')).not.toBeInTheDocument();
  });

  it('una derrama personal (sin inmueble) NO pregunta · es un gasto más', () => {
    render(<FichaMovimiento {...base} />);
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'comunidad' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'derrama' } });
    expect(screen.queryByText('¿Conservación o mejora?')).not.toBeInTheDocument();
  });

  it('aparece solo al elegir derrama, y bloquea guardar hasta responderla', () => {
    render(<FichaMovimiento {...base} />);
    elegirDerrama();

    expect(screen.getByText('¿Conservación o mejora?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('conservación se guarda como gasto deducible', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    elegirDerrama();
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conservación' }));
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'comunidad_inmueble', esMejora: false })
    );
  });

  it('mejora NO se guarda como gasto: se capitaliza y amortiza', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    elegirDerrama();
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mejora' }));
    guardar();

    // Sin categoryKey de gasto · va a `mejorasInmueble`.
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: null, esMejora: true, naturalezaDerrama: 'mejora' })
    );
  });

  it('cambiar de concepto olvida la respuesta anterior', () => {
    render(<FichaMovimiento {...base} />);
    elegirDerrama();
    fireEvent.click(screen.getByRole('button', { name: 'Mejora' }));
    // Se vuelve a un concepto normal y de nuevo a derrama.
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'comunidad_ordinaria' } });
    fireEvent.change(screen.getByLabelText('Concepto del gasto'), { target: { value: 'derrama' } });

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
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
      expect.objectContaining({ tipo: 'transferencia', categoryKey: null, inmuebleId: null })
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
          familia: 'suministros',
          subtipo: 'luz',
          inmuebleId: 7,
        }}
      />
    );

    expect(screen.getByLabelText('Descripción')).toHaveValue('Recibo Iberdrola');
    expect(screen.getByLabelText('Familia')).toHaveValue('suministros');
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
    expect(screen.getByLabelText('Concepto del gasto')).toBeDisabled();
  });

  it('y guarda sin tocar la clasificación · categoryKey undefined, no null', () => {
    const onGuardar = jest.fn();
    render(
      <FichaMovimiento {...base} inicial={{ tipo: 'gasto', concepto: 'x' }} onGuardar={onGuardar} />
    );
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    const v = onGuardar.mock.calls[0][0];
    expect(v.categoryKey).toBeUndefined();
    expect(v.subtypeKey).toBeUndefined();
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
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'tributos' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'ibi_inmueble' })
    );
  });

  it('reclasificar a un concepto sin variante manda subtypeKey null · borra el viejo', () => {
    const onGuardar = jest.fn();
    render(<FichaMovimiento {...base} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Inmueble'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'tributos' } });
    fireEvent.change(screen.getByLabelText('Importe real'), { target: { value: '10' } });
    guardar();

    // `null` y no `undefined`: undefined sería "no toques" y dejaría pegado el
    // subtipo de la clasificación anterior.
    expect(onGuardar.mock.calls[0][0].subtypeKey).toBeNull();
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
