// Un tipo, un sitio.
//
// El wizard tenía DOS controles para el mismo campo: el `<select>` «Modalidad»
// del paso 1 y los tres botones de régimen del bloque fiscal, en el paso 3. Como
// no se ven a la vez, se podía dejar «Turístico» arriba y «Vivienda habitual»
// abajo; ganaba el último que se tocara, y el usuario no tenía forma de saber
// cuál era.
//
// Lo que se prueba: que solo queda un control, que está junto a las fechas —de
// donde sale su propuesta— y que el bloque fiscal LEE de ahí, así que cambiar el
// tipo cambia la reducción que propone.

import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import NuevoContratoWizard from '../NuevoContratoWizard';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Property } from '../../../../services/db';

jest.mock('../../../../services/contractService', () => ({
  ...jest.requireActual('../../../../services/contractService'),
  saveContract: jest.fn(),
  getContract: jest.fn(),
  updateContract: jest.fn(),
}));
jest.mock('../../../../services/treasuryBootstrapService', () => ({
  regenerateForecastsForward: jest.fn(),
}));
jest.mock('../../../../services/treasuryApiService', () => ({
  treasuryAPI: { accounts: { getAccounts: () => Promise.resolve([{ id: 7 }]) } },
}));

const property = (id: number, alias: string): Property =>
  ({
    id, alias, address: '', postalCode: '', province: '', municipality: '', ccaa: '',
    purchaseDate: '2020-01-01', squareMeters: 50, bedrooms: 1, transmissionRegime: 'usada',
    state: 'activo', acquisitionCosts: { price: 100000 }, documents: [],
  }) as Property;

const ctx: InmueblesOutletContext = {
  properties: [property(1, 'Fuertes Acevedo 32')],
  contracts: [],
  reload: jest.fn(),
};

const OutletWrapper: React.FC = () => <Outlet context={ctx} />;

const renderWizard = () =>
  render(
    <MemoryRouter initialEntries={['/contratos/nuevo?inmueble=1']}>
      <Routes>
        <Route element={<OutletWrapper />}>
          <Route path="/contratos/nuevo" element={<NuevoContratoWizard />} />
        </Route>
        <Route path="/contratos" element={<div>listado</div>} />
      </Routes>
    </MemoryRouter>,
  );

const siguiente = (): void => {
  const botones = screen.getAllByRole('button', { name: /Siguiente/i });
  fireEvent.click(botones[botones.length - 1]);
};

/** Del paso 1 al paso Económico, que es donde vive el bloque fiscal. */
const irAlEconomico = async (): Promise<void> => {
  siguiente();
  await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5));
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[1], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[2], { target: { value: '53069494F' } });
  fireEvent.change(inputs[3], { target: { value: '600123123' } });
  fireEvent.change(inputs[4], { target: { value: 'prueba@example.com' } });
  siguiente();
};

describe('solo hay un sitio donde se elige el tipo', () => {
  it('el selector está en el paso 1, junto a las fechas de las que sale su propuesta', async () => {
    renderWizard();
    expect(await screen.findByRole('radiogroup', { name: /Tipo de alquiler/i })).toBeInTheDocument();
    // Y ya no hay un desplegable de modalidad compitiendo con él.
    expect(screen.queryByLabelText(/^Modalidad$/i)).toBeNull();
  });

  it('el bloque fiscal ya no trae sus propios botones de régimen', async () => {
    renderWizard();
    await irAlEconomico();

    await screen.findByText(/Reducción que ATLAS propone/);
    // El bloque sigue ahí, pero sin su selector: el del paso 1 es el único.
    expect(screen.queryByRole('radiogroup', { name: /Régimen del alquiler/i })).toBeNull();
  });
});

describe('el bloque fiscal consume el tipo elegido', () => {
  it('larga duración → propone reducción; corta estancia → 0 %', async () => {
    renderWizard();

    // Por defecto el alta nace en larga duración, que sí reduce.
    await irAlEconomico();
    await screen.findByText('50%');

    // Vuelvo al paso 1 y lo cambio a corta estancia.
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    fireEvent.click(await screen.findByRole('radio', { name: /Corta estancia/ }));

    siguiente();
    await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5));
    siguiente();

    // El bloque fiscal, sin tocarlo, ya propone otra cosa.
    expect(await screen.findByText('0%')).toBeInTheDocument();
  });
});
