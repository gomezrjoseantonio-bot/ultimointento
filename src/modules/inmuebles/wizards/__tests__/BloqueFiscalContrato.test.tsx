// El bloque fiscal propone, razona, y no guarda nada hasta que se confirma.
//
// Lo que se vigila: que el % que el usuario VE sea el que se guarda, que cambiar
// una condición invalide lo confirmado —si no, quedaría aprobado un número que
// ya no sale de esas condiciones—, y que «ajustar a mano» deje constancia.

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BloqueFiscalContrato, { type DatosFiscalesContrato } from '../BloqueFiscalContrato';

/**
 * Normaliza para comparar cifras: `Intl` mete espacios finos y no-rompibles, y
 * el jsdom de CI trae un ICU recortado que NO pone el punto de los miles («3000»
 * donde el navegador escribe «3.000»). Comparar el texto crudo ataría el test al
 * ICU de quien lo ejecute, no a lo que hace el componente.
 */
const texto = (s: string): string => s.replace(/\s/g, ' ').replace(/\./g, '');

const pintar = (props?: Partial<React.ComponentProps<typeof BloqueFiscalContrato>>) => {
  const onChange = jest.fn();
  const onModalidadChange = jest.fn();
  const utils = render(
    <BloqueFiscalContrato
      modalidad="habitual"
      onModalidadChange={onModalidadChange}
      rentaMensual="500"
      fechaInicio="2026-08-15"
      value={undefined}
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange, onModalidadChange };
};

const condicion = (nombre: string): HTMLElement =>
  screen.getByRole('switch', { name: new RegExp(nombre, 'i') });

/** Lo que ya viene confirmado desde el formulario. */
const yaConfirmado = (extra?: Partial<DatosFiscalesContrato>): DatosFiscalesContrato => ({
  reduccion: { activa: false, porcentaje: 0 },
  fechaFirmaContrato: '2026-08-15',
  primeraVez: false,
  zonaTensionada: false,
  inquilinoJoven: false,
  rebajaRenta5pct: false,
  rehabilitacion: false,
  ...extra,
});

describe('bloque fiscal · propuesta', () => {
  it('un habitual sin condiciones propone el 50 % general', () => {
    pintar();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(texto(document.body.textContent ?? '')).toContain('reducción general del 50 %');
  });

  it('enseña el impacto en euros sobre la renta anual', () => {
    // 500 €/mes son 6.000 € al año; con el 50 % se tributa por 3.000 €.
    pintar();
    expect(texto(document.body.textContent ?? '')).toContain('3000 €');
    expect(texto(document.body.textContent ?? '')).toContain('de 6000 €');
  });

  it('temporada · sin reducción y se tributa por todo', () => {
    pintar({ modalidad: 'temporada' });
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(texto(document.body.textContent ?? '')).toContain('no cubre una necesidad permanente');
  });

  it('primera vez + tensionada + joven → propone el 70 %', () => {
    pintar({
      value: yaConfirmado({ primeraVez: true, zonaTensionada: true, inquilinoJoven: true }),
    });
    expect(screen.getByText('70%')).toBeInTheDocument();
    // 6.000 con el 70 % → 1.800.
    expect(texto(document.body.textContent ?? '')).toContain('1800 €');
  });

  it('cada propuesta viene con su base legal y sus avisos', () => {
    pintar();
    expect(texto(document.body.textContent ?? '')).toContain('Art 232');
    expect(texto(document.body.textContent ?? '')).toContain('art 176 LAU');
  });
});

describe('bloque fiscal · confirmar y ajustar', () => {
  it('confirmar guarda el porcentaje propuesto y su motivo', () => {
    const { onChange } = pintar({
      value: yaConfirmado({ primeraVez: true, zonaTensionada: true, inquilinoJoven: true }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar reducción/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reduccion: { activa: true, porcentaje: 70, motivo: 'zona_tensionada_joven' },
      }),
    );
  });

  it('hasta que no se confirma, no hay nada guardado', () => {
    pintar();
    expect(texto(document.body.textContent ?? '')).not.toContain('Reducción confirmada');
  });

  it('cambiar una condición invalida lo ya confirmado', () => {
    // Si no, quedaría aprobado un 70 % que ya no sale de estas condiciones.
    const { onChange } = pintar({
      value: yaConfirmado({
        reduccion: { activa: true, porcentaje: 70, motivo: 'zona_tensionada_joven' },
        primeraVez: true,
        zonaTensionada: true,
        inquilinoJoven: true,
      }),
    });

    fireEvent.click(condicion('Inquilino joven'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ reduccion: { activa: false, porcentaje: 0 } }),
    );
  });

  it('un porcentaje puesto a mano queda marcado como manual', () => {
    const { onChange } = pintar();

    fireEvent.click(screen.getByRole('button', { name: /Ajustar a mano/i }));
    fireEvent.change(screen.getByLabelText(/Reducción fijada por ti/i), {
      target: { value: '60' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reduccion: expect.objectContaining({ porcentaje: 60, manual: true }),
      }),
    );
  });

  it('el porcentaje a mano se acota entre 0 y 100', () => {
    const { onChange } = pintar();

    fireEvent.click(screen.getByRole('button', { name: /Ajustar a mano/i }));
    fireEvent.change(screen.getByLabelText(/Reducción fijada por ti/i), {
      target: { value: '250' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reduccion: expect.objectContaining({ porcentaje: 100 }),
      }),
    );
  });

  it('cambiar de régimen también invalida lo confirmado', () => {
    const { onChange, onModalidadChange } = pintar({
      value: yaConfirmado({ reduccion: { activa: true, porcentaje: 50 } }),
    });

    fireEvent.click(screen.getByRole('radio', { name: /Temporada/i }));

    expect(onModalidadChange).toHaveBeenCalledWith('temporada');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ reduccion: { activa: false, porcentaje: 0 } }),
    );
  });
});
