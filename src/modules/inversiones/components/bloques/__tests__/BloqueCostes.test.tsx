// Smoke test · BloqueCostes (PR 4 · spec §11 fila 8).
// T-FICHA-PP-PULIDO v1 · Bug #2 · el botón "Buscar plan con TER menor" ya
// no existe en ningún tipo de plan · los tests comprueban su ausencia.
// Verifica copy tipo-aware ("Lo que te cobra…" / "Lo que cuesta…").

import '@testing-library/jest-dom';

// Mock service de avisos · el hook `useAvisoCerrable` lo consume.
const mockEstaAvisoActivo = jest.fn();
const mockCerrarAviso = jest.fn();
jest.mock('../../../../../services/avisosUsuarioService', () => ({
  estaAvisoActivo: (...args: any[]) => mockEstaAvisoActivo(...args),
  cerrarAviso: (...args: any[]) => mockCerrarAviso(...args),
}));

jest.mock('../../../../../design-system/v5', () => ({
  showToastV5: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BloqueCostes from '../BloqueCostes';

const baseProps = {
  posicionId: 'plan-1',
  tipoActivo: 'plan_pensiones' as const,
  // ter en formato porcentual (1.38 = 1,38 %).
  ter: 1.38,
  terFuente: 'catalogo' as const,
  terFuenteDetalle: 'bbva.es',
  saldoMedioAnual: 36000,
  anosTranscurridos: 17,
  anosHastaRescate: 23,
  saldoMedioProyectado: 70000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEstaAvisoActivo.mockResolvedValue(true);
  mockCerrarAviso.mockResolvedValue(undefined);
});

describe('BloqueCostes · tipo-aware copy (§5.4) + Bug #2', () => {
  test('PPI · título "Lo que te cobra la gestora" · SIN botón "Buscar plan con TER menor"', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    expect(await screen.findByText('Lo que te cobra la gestora')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
  });

  test('PPE · título "Lo que cuesta tener este plan" · SIN botón "Buscar plan con TER menor"', async () => {
    render(
      <BloqueCostes {...baseProps} tipoPlan="PPE" nombreEmpresa="Orange España" />,
    );
    expect(await screen.findByText('Lo que cuesta tener este plan')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
  });

  test('PPES · sin botón · igual que PPI (Bug #2)', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPES" />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
  });

  test('PPA garantizado · SIN botón · banner info-garantizado visible', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPA" garantizado />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/garantizado/)).toBeInTheDocument(),
    );
  });

  test('PPA NO garantizado · sin botón (Bug #2)', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPA" garantizado={false} />);
    await screen.findByText('Lo que te cobra la gestora');
    expect(
      screen.queryByRole('button', { name: /Buscar plan con TER menor/ }),
    ).not.toBeInTheDocument();
  });

  test('PPE · banner sustituye {nombreEmpresa}', async () => {
    render(
      <BloqueCostes {...baseProps} tipoPlan="PPE" nombreEmpresa="Orange España" />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Orange España/)).toBeInTheDocument(),
    );
  });

  test('PPE · banner cerrable · usa avisoId coste-ppe-info', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPE" />);
    const cerrar = await screen.findByLabelText('Cerrar aviso de comisiones');
    fireEvent.click(cerrar);
    await waitFor(() =>
      expect(mockCerrarAviso).toHaveBeenCalledWith(
        'coste-ppe-info',
        expect.any(Object),
      ),
    );
  });

  // T-FICHA-PP-DEUDA v1 · Fix #4 · banner orphan eliminado para PPI/PPES.
  test('PPI · sin banner orphan "coste-cambio-gestora-cta"', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    await screen.findByText('Lo que te cobra la gestora');
    await waitFor(() => {
      expect(
        screen.queryByLabelText('Cerrar aviso de comisiones'),
      ).not.toBeInTheDocument();
    });
    // Verifica que la id legacy nunca se invoca en cerrarAviso.
    expect(mockCerrarAviso).not.toHaveBeenCalledWith(
      'coste-cambio-gestora-cta',
      expect.anything(),
    );
  });

  test('PPES · sin banner orphan (Fix #4)', async () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPES" />);
    await screen.findByText('Lo que te cobra la gestora');
    await waitFor(() => {
      expect(
        screen.queryByLabelText('Cerrar aviso de comisiones'),
      ).not.toBeInTheDocument();
    });
  });
});

describe('BloqueCostes · TER · Bug #1', () => {
  test('ter=null · sin KPIs · CTA "Añadir TER manualmente" visible', () => {
    const onEditTer = jest.fn();
    render(
      <BloqueCostes
        {...baseProps}
        ter={null}
        terFuente="desconocido"
        tipoPlan="PPI"
        onEditTer={onEditTer}
      />,
    );
    expect(
      screen.getByText(/No tenemos el TER de este plan/i),
    ).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /Añadir TER manualmente/ });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onEditTer).toHaveBeenCalled();
  });

  test('terFuente=catalogo · subtítulo incluye fuente del catálogo', () => {
    render(<BloqueCostes {...baseProps} tipoPlan="PPI" />);
    expect(
      screen.getByText(/catálogo ATLAS · bbva\.es/i),
    ).toBeInTheDocument();
  });

  test('terFuente=manual · subtítulo "dato introducido por ti"', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={0.75}
        terFuente="manual"
        terFuenteDetalle={undefined}
      />,
    );
    expect(
      screen.getByText(/dato introducido por ti/i),
    ).toBeInTheDocument();
  });

  test('ter visible · CTA "editar TER" llama onEditTer', () => {
    const onEditTer = jest.fn();
    render(
      <BloqueCostes {...baseProps} tipoPlan="PPI" onEditTer={onEditTer} />,
    );
    const cta = screen.getByRole('button', { name: /editar TER/i });
    fireEvent.click(cta);
    expect(onEditTer).toHaveBeenCalled();
  });
});

// T-FICHA-PP-DEUDA v1 · Fix #3 · fila comparativa "Media del mercado".
describe('BloqueCostes · Fix #3 · comparativa media del mercado', () => {
  test('ter por debajo de la media · badge "↓ Por debajo"', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={0.43}
        terMediaMercado={1.1}
      />,
    );
    const fila = screen.getByTestId('ter-fila-comparativa');
    expect(fila).toHaveTextContent('Media del mercado');
    expect(fila).toHaveTextContent('1.10 %');
    expect(fila).toHaveTextContent(/Por debajo/);
  });

  test('ter por encima de la media · badge "↑ Por encima"', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={1.5}
        terMediaMercado={1.1}
      />,
    );
    expect(screen.getByTestId('ter-fila-comparativa')).toHaveTextContent(
      /Por encima/,
    );
  });

  test('ter en línea con la media · badge "= En línea"', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={1.1}
        terMediaMercado={1.1}
      />,
    );
    expect(screen.getByTestId('ter-fila-comparativa')).toHaveTextContent(
      /En línea/,
    );
  });

  test('terMediaMercado=null · sin fila comparativa', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={1.1}
        terMediaMercado={null}
      />,
    );
    expect(
      screen.queryByTestId('ter-fila-comparativa'),
    ).not.toBeInTheDocument();
  });

  test('ter=null + terMediaMercado presente · fila visible sin badge', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        ter={null}
        terFuente="desconocido"
        terMediaMercado={1.1}
      />,
    );
    const fila = screen.getByTestId('ter-fila-comparativa');
    expect(fila).toHaveTextContent('Media del mercado');
    expect(fila).toHaveTextContent('1.10 %');
    // Sin TER del plan, no hay comparativa · ningún texto de badge.
    expect(fila).not.toHaveTextContent(/Por debajo/);
    expect(fila).not.toHaveTextContent(/Por encima/);
    expect(fila).not.toHaveTextContent(/En línea/);
  });
});

// T-FICHA-PP-DEUDA v1 · Fix #1 · hint "estimación por defecto" con link Mi Plan.
describe('BloqueCostes · Fix #1 · hint estimación por defecto', () => {
  test('esEstimacionPorDefecto=true · hint visible con link', () => {
    const onIrAMiPlan = jest.fn();
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        esEstimacionPorDefecto
        onIrAMiPlan={onIrAMiPlan}
      />,
    );
    expect(
      screen.getByText(/Estimación por defecto/i),
    ).toBeInTheDocument();
    const link = screen.getByRole('button', {
      name: /configura tu escenario en Mi Plan/i,
    });
    fireEvent.click(link);
    expect(onIrAMiPlan).toHaveBeenCalled();
  });

  test('esEstimacionPorDefecto=false · sin hint', () => {
    render(
      <BloqueCostes
        {...baseProps}
        tipoPlan="PPI"
        esEstimacionPorDefecto={false}
      />,
    );
    expect(
      screen.queryByText(/Estimación por defecto/i),
    ).not.toBeInTheDocument();
  });
});
