import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ContratosDrawer from '../ContratosDrawer';

describe('ContratosDrawer', () => {
  test('no renderiza nada cuando open=false', () => {
    render(
      <ContratosDrawer
        open={false}
        onClose={() => {}}
        tone="neg"
        label="Test"
        title="Title"
      >
        <div>contenido</div>
      </ContratosDrawer>,
    );
    expect(screen.queryByText('contenido')).toBeNull();
  });

  test('renderiza hero, body y stats cuando open=true', () => {
    render(
      <ContratosDrawer
        open
        onClose={() => {}}
        tone="warn"
        label="Decisión urgente"
        title="Vencen en 30 días"
        sub="sub copy"
        stats={[
          { label: 'A', value: '10' },
          { label: 'B', value: '20' },
        ]}
      >
        <div>contenido drawer</div>
      </ContratosDrawer>,
    );
    expect(screen.getByText('Decisión urgente')).toBeInTheDocument();
    expect(screen.getByText('Vencen en 30 días')).toBeInTheDocument();
    expect(screen.getByText('sub copy')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('contenido drawer')).toBeInTheDocument();
  });

  test('tecla ESC invoca onClose', () => {
    const onClose = jest.fn();
    render(
      <ContratosDrawer
        open
        onClose={onClose}
        tone="neg"
        label="X"
        title="Y"
      >
        <div />
      </ContratosDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('click en backdrop invoca onClose', () => {
    const onClose = jest.fn();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(
      <ContratosDrawer
        open
        onClose={onClose}
        tone="neg"
        label="X"
        title="Y"
      >
        <div />
      </ContratosDrawer>,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('botón cerrar (X) invoca onClose', () => {
    const onClose = jest.fn();
    render(
      <ContratosDrawer
        open
        onClose={onClose}
        tone="neg"
        label="X"
        title="Y"
      >
        <div />
      </ContratosDrawer>,
    );
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
