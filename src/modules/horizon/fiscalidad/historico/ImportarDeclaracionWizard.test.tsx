import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ImportarDeclaracionWizard from './ImportarDeclaracionWizard';

jest.mock('../../../../services/scanChatService', () => ({
  callScanChat: jest.fn(),
}));

describe('ImportarDeclaracionWizard', () => {
  it('renderiza el flujo con el nuevo paso de onboarding de entidades', () => {
    render(<ImportarDeclaracionWizard onClose={() => undefined} onImported={() => undefined} />);

    expect(screen.getByText('Importar declaración IRPF')).toBeInTheDocument();
    expect(screen.getByText('Paso 4')).toBeInTheDocument();
    expect(screen.getByText('Formulario manual')).toBeInTheDocument();
    expect(screen.getByText('Subir PDF del Modelo 100')).toBeInTheDocument();
  });
});
