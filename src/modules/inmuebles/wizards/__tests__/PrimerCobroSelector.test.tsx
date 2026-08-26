// El selector de primer cobro propone, el usuario ajusta, y lo que sale es lo
// que se cobra.
//
// Lo que se vigila aquí es que la cifra que el usuario VE al elegir un modo sea
// exactamente la que se guarda en `primerCobro.importe` — porque es esa, y no el
// modo, la que el generador de previsiones emite. Si la pantalla enseñara una y
// guardara otra, el usuario firmaría un número y ATLAS pediría otro.

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import PrimerCobroSelector from '../PrimerCobroSelector';
import type { PrimerCobroContrato } from '../../../../services/db/types-contratos';

/** `Intl` mete espacios finos y no-rompibles entre cifra y símbolo. */
const texto = (s: string): string => s.replace(/\s/g, ' ');

const pintar = (props?: Partial<React.ComponentProps<typeof PrimerCobroSelector>>) => {
  const onChange = jest.fn();
  const utils = render(
    <PrimerCobroSelector
      rentaMensual="365"
      fechaInicio="2026-08-15"
      value={undefined}
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange };
};

const opcion = (nombre: string): HTMLElement =>
  screen.getByRole('radio', { name: new RegExp(nombre, 'i') });

describe('selector de primer cobro', () => {
  // Caso real: 365 €/mes entrando el 15 de agosto. Agosto tiene 31 días, así que
  // se ocupan 17 (del 15 al 31): 365 × 17/31 = 200,16 €.
  it('propone las tres cifras calculadas sobre la renta y la fecha de entrada', () => {
    pintar();

    expect(texto(opcion('Prorrateo simple').textContent ?? '')).toContain('200,16');
    expect(texto(opcion('Mes entero').textContent ?? '')).toContain('365,00');
    // 200,16 + 365 = 565,16
    expect(texto(opcion('Días en curso').textContent ?? '')).toContain('565,16');
    // El manual no propone nada: lo fija el arrendador.
    expect(texto(opcion('Importe manual').textContent ?? '')).toContain('a mano');
  });

  it('enseña de dónde sale la cifra · días y meses reales, no texto genérico', () => {
    pintar();

    expect(texto(opcion('Prorrateo simple').textContent ?? '')).toContain('17 días de agosto');
    expect(texto(opcion('Días en curso').textContent ?? '')).toContain(
      '17 días de agosto + septiembre completo',
    );
  });

  it('al elegir un modo guarda su importe, no solo el modo', () => {
    const { onChange } = pintar();

    fireEvent.click(opcion('Días en curso'));

    expect(onChange).toHaveBeenCalledWith<[PrimerCobroContrato]>({
      modo: 'dias_mas_adelanto',
      importe: 565.16,
    });
  });

  it('el importe se puede ajustar a mano sin cambiar de modo', () => {
    // El pactado del contrato real es 565 € redondos, no los 565,16 aritméticos.
    const { onChange } = pintar({
      value: { modo: 'dias_mas_adelanto', importe: 565.16 },
    });

    fireEvent.change(screen.getByLabelText('Importe del primer cobro'), {
      target: { value: '565' },
    });

    expect(onChange).toHaveBeenCalledWith<[PrimerCobroContrato]>({
      modo: 'dias_mas_adelanto',
      importe: 565,
    });
  });

  it('el importe ajustado manda sobre la propuesta del modo', () => {
    pintar({ value: { modo: 'prorrateo', importe: 210 } });

    expect((screen.getByLabelText('Importe del primer cobro') as HTMLInputElement).value).toBe(
      '210,00',
    );
  });

  // El mockup dice «a partir del segundo mes, la renta recurrente es X». En el
  // modo de mes adelantado eso sería FALSO: ese segundo mes se cobra aquí.
  it('en mes adelantado avisa de que el mes siguiente ya va cobrado', () => {
    pintar({ value: { modo: 'dias_mas_adelanto', importe: 565 } });

    expect(texto(document.body.textContent ?? '')).toContain(
      'Septiembre va cobrado en este primer pago',
    );
    expect(texto(document.body.textContent ?? '')).not.toContain('A partir del segundo mes');
  });

  it('en los demás modos, la nota es la del mockup', () => {
    pintar({ value: { modo: 'prorrateo', importe: 200.16 } });

    expect(texto(document.body.textContent ?? '')).toContain('A partir del segundo mes');
  });

  it('sin fecha de entrada no inventa cifras', () => {
    pintar({ fechaInicio: '' });

    expect(texto(opcion('Prorrateo simple').textContent ?? '')).toContain('—');
    expect(texto(document.body.textContent ?? '')).toContain('Indica la fecha de entrada');
  });
});
