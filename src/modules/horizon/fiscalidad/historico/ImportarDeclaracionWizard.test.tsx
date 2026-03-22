import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ImportarDeclaracionWizard from './ImportarDeclaracionWizard';

jest.mock('../../../../services/scanChatService', () => ({
  callScanChat: jest.fn(),
}));

describe('ImportarDeclaracionWizard', () => {
  it('renderiza el flujo base del wizard de importación AEAT', () => {
    render(<ImportarDeclaracionWizard onClose={() => undefined} onImported={() => undefined} />);

    expect(screen.getByText('Importar declaración IRPF')).toBeInTheDocument();
    expect(screen.getByText('Paso 3')).toBeInTheDocument();
    expect(screen.getByText('Formulario manual')).toBeInTheDocument();
    expect(screen.getByText('Subir PDF del Modelo 100')).toBeInTheDocument();
  });
});
