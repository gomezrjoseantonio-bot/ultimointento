// El EFECTIVO es una cuenta más · el dinero del bolsillo.
//
// Existe para que una retirada de cajero sea lo que de verdad es —una
// transferencia interna: el dinero no se va, cambia de sitio— en vez de un
// gasto que hunde el patrimonio el día que sacas 200 €.
//
// Lo que fija este candado: que no se le pidan al usuario datos que esa cuenta
// NO puede tener. Un IBAN de tu cartera no existe, y un campo que nunca se
// rellena es una pregunta sin respuesta posible.

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CuentaWizard from '../CuentaWizard';
import { cuentasService } from '../../../services/cuentasService';

jest.mock('../../../services/cuentasService', () => ({
  cuentasService: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

beforeEach(() => {
  (cuentasService.list as jest.Mock).mockResolvedValue([]);
});

const elegirEfectivo = () => fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));

describe('la cuenta de Efectivo', () => {
  it('se puede elegir como tipo, junto a las de banco', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Efectivo' })).toBeInTheDocument();
  });

  it('no pide IBAN ni banco · tu cartera no los tiene', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    // De partida es una corriente y sí los pide.
    expect(screen.getByText('Datos bancarios')).toBeInTheDocument();
    expect(screen.getByText('Banco / proveedor')).toBeInTheDocument();

    elegirEfectivo();

    expect(screen.queryByText('Datos bancarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Banco / proveedor')).not.toBeInTheDocument();
  });

  // Lo que sí hace falta saber es cuánto llevas encima y desde cuándo: es el
  // punto de partida del saldo, igual que en cualquier otra cuenta.
  it('sí pide cuánto hay y desde cuándo', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    elegirEfectivo();
    expect(screen.getByText('Saldo inicial')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  // El dinero del bolsillo no da intereses.
  it('no ofrece remuneración', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    expect(screen.getByText('Cuenta remunerada')).toBeInTheDocument();
    elegirEfectivo();
    expect(screen.queryByText('Cuenta remunerada')).not.toBeInTheDocument();
  });

  it('se guarda SIN iban · no se inventa uno para rellenar el hueco', async () => {
    (cuentasService.create as jest.Mock).mockResolvedValue({ id: 9 });
    render(<CuentaWizard open onClose={() => {}} />);
    elegirEfectivo();

    fireEvent.change(screen.getByPlaceholderText('Ej. Santander Alquileres'), {
      target: { value: 'Cartera' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await screen.findByRole('button', { name: /Guardar/ });
    expect(cuentasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'Cartera', tipo: 'EFECTIVO', iban: undefined })
    );
  });
});
