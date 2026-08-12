import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TablaActivos from '../TablaActivos';
import type { Contract } from '../../../../services/db';

const base = (over: Partial<Contract>): Contract & { id: number } =>
  ({
    id: 1,
    inmuebleId: 9,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Agencia XYZ', apellidos: '', dni: '', telefono: '', email: '' },
    fechaInicio: '2026-01-01',
    fechaFin: '2029-01-01',
    rentaMensual: 1350,
    diaPago: 1,
    estadoContrato: 'activo',
    documentoFirmado: true,
    ...over,
  }) as Contract & { id: number };

const padre = base({
  id: 1,
  gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
});
const hijo1 = base({ id: 2, gestionPadreId: 1, inquilino: { nombre: 'Ana', apellidos: 'García', dni: '', telefono: '', email: '' }, rentaMensual: 600 });
const hijo2 = base({ id: 3, gestionPadreId: 1, inquilino: { nombre: 'Luis', apellidos: 'Pérez', dni: '', telefono: '', email: '' }, rentaMensual: 550 });

test('pinta los subcontratos anidados bajo el padre y abren su propia ficha', () => {
  const onAbrir = jest.fn();
  render(
    <TablaActivos
      contratos={[padre]}
      subcontratosByPadre={new Map([[1, [hijo1, hijo2]]])}
      inmuebleAliasById={new Map([[9, 'Fuertes Acevedo 32']])}
      onAbrirFicha={onAbrir}
    />,
  );

  // El padre y sus dos hijos anexados aparecen en la tabla.
  expect(screen.getByText('Agencia XYZ')).toBeInTheDocument();
  expect(screen.getByText('Ana García')).toBeInTheDocument();
  expect(screen.getByText('Luis Pérez')).toBeInTheDocument();

  // Click en un hijo abre su ficha (no la del padre).
  fireEvent.click(screen.getByText('Ana García'));
  expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: 2, gestionPadreId: 1 }));
});
