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
  cuentasService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    // §1 · la ficha pregunta al servicio si ya hay un colchón · aquí no hay.
    efectivoExistente: jest.fn(),
  },
}));

beforeEach(() => {
  (cuentasService.list as jest.Mock).mockResolvedValue([]);
  (cuentasService.efectivoExistente as jest.Mock).mockResolvedValue(undefined);
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

  // Lo que sí hace falta saber es cuánto llevas encima HOY: es el punto de
  // partida del saldo, igual que en cualquier otra cuenta (§31 · la fecha la
  // pone ATLAS, es hoy, y nadie tiene que inventarse una apertura).
  it('sí pide cuánto hay hoy', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    elegirEfectivo();
    expect(screen.getByText('Saldo de hoy')).toBeInTheDocument();
    expect(screen.getByText('¿Cuánto tienes hoy?')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  // El dinero del bolsillo no da intereses.
  it('no ofrece remuneración', () => {
    render(<CuentaWizard open onClose={() => {}} />);
    expect(screen.getByText('Cuenta remunerada')).toBeInTheDocument();
    elegirEfectivo();
    expect(screen.queryByText('Cuenta remunerada')).not.toBeInTheDocument();
  });

  // Esconder los campos no basta: el valor seguía en el formulario. Con "Otro ·
  // escribir" elegido antes de cambiar de tipo, el guardado se bloqueaba
  // pidiendo un campo que ya no estaba en pantalla — sin forma de arreglarlo.
  it('cambiar a efectivo BORRA lo bancario que se hubiera tecleado', async () => {
    (cuentasService.create as jest.Mock).mockResolvedValue({ id: 9 });
    render(<CuentaWizard open onClose={() => {}} />);

    // El select del banco no tiene `for`, así que se busca por su opción.
    const selectBanco = screen
      .getByRole('option', { name: 'Otro · escribir' })
      .closest('select') as HTMLSelectElement;
    fireEvent.change(selectBanco, { target: { value: 'Otro · escribir' } });
    expect(screen.getByText('Nombre del banco')).toBeInTheDocument();

    elegirEfectivo();
    expect(screen.queryByText('Nombre del banco')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej. Santander Alquileres'), {
      target: { value: 'Cartera' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    // Se guarda · no se queda bloqueado por un campo invisible.
    await screen.findByRole('button', { name: /Guardar/ });
    expect(cuentasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'EFECTIVO', iban: undefined })
    );
    // Y no arrastra metadatos de banco a una cuenta que no tiene ninguno.
    expect(cuentasService.create).toHaveBeenCalledWith(
      expect.objectContaining({ bic: undefined })
    );
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
