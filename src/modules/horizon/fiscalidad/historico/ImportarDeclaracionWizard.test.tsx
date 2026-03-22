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
    expect(screen.getByText('PASO 1 — SUBIR PDF')).toBeInTheDocument();
    expect(screen.getByText('PDF AEAT')).toBeInTheDocument();
    expect(screen.getByText('Formulario manual')).toBeInTheDocument();
    expect(screen.getByText('Arrastra el PDF aquí o haz clic para seleccionar')).toBeInTheDocument();
  });
});
