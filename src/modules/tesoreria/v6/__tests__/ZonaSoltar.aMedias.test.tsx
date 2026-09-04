// E1.3 · el Paso 1 enseña los extractos a medias y deja retomarlos.

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ZonaSoltar from '../conciliar/ZonaSoltar';
import type { Account } from '../../../../services/db';
import type { LoteAMedias } from '../decisionesPersistidas';

const cuentas = [
  { id: 7, alias: 'Sabadell', ultimosCuatro: '2715', isActive: true, status: 'ACTIVE' },
] as unknown as Account[];

const lote = (over: Partial<LoteAMedias> = {}): LoteAMedias => ({
  importBatchId: 'import_1',
  filename: 'agosto.xlsx',
  accountId: 7,
  timestampImport: '2026-08-30T10:00:00.000Z',
  lineas: 102,
  decididas: 40,
  ...over,
});

function pintar(over: Partial<React.ComponentProps<typeof ZonaSoltar>> = {}) {
  const onRetomar = jest.fn();
  render(
    <ZonaSoltar
      cuenta={null}
      cuentas={cuentas}
      tarjetas={[]}
      deteccion={null}
      procesando={false}
      arrastrando={false}
      setArrastrando={() => {}}
      avisoReimport={null}
      error={null}
      onElegirCuenta={() => {}}
      onElegirTarjeta={() => {}}
      onFichero={() => {}}
      onImportarDeTodasFormas={() => {}}
      onOtroFichero={() => {}}
      onRetomar={onRetomar}
      {...over}
    />
  );
  return { onRetomar };
}

describe('E1.3 · ZonaSoltar · extractos a medias', () => {
  it('sin lotes a medias no enseña nada de eso · la zona de soltar sigue ahí', () => {
    pintar({ aMedias: [] });
    expect(screen.queryByText(/a medias/i)).not.toBeInTheDocument();
    expect(screen.getByText(/arrastra aquí el extracto/i)).toBeInTheDocument();
  });

  it('con uno · lo nombra, dice de qué cuenta es y cuántas líneas van decididas', () => {
    pintar({ aMedias: [lote()] });
    expect(screen.getByText('Tienes un extracto a medias')).toBeInTheDocument();
    expect(screen.getByText(/agosto\.xlsx · Sabadell · \*\*\*\*2715 · .*40 de 102 líneas decididas/)).toBeInTheDocument();
  });

  it('retomar llama con el lote entero', () => {
    const l = lote();
    const { onRetomar } = pintar({ aMedias: [l, lote({ importBatchId: 'import_2', filename: 'julio.xlsx' })] });
    expect(screen.getByText('Tienes 2 extractos a medias')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retomar agosto.xlsx' }));
    expect(onRetomar).toHaveBeenCalledWith(l);
  });

  it('mientras se procesa un fichero la lista se esconde · no se retoma a mitad de otro', () => {
    pintar({ aMedias: [lote()], procesando: true });
    expect(screen.queryByText(/a medias/i)).not.toBeInTheDocument();
  });
});
