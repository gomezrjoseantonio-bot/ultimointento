// Commit 6 · tests del paso 3 · 3 secciones con acciones por bloque.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PasoRevision from '../PasoRevision';
import { ContractDraft } from '../../../../services/contractDraftService';

const baseDraft = (overrides: Partial<ContractDraft>): ContractDraft => ({
  filaOriginal: 1,
  ficheroOrigen: 'activos.xlsx',
  origen: 'rentila',
  inmuebleRaw: '1-SANT FRUITOS',
  inmuebleIdSugerido: 1,
  inmuebleIdConfirmado: 1,
  inquilinoNombre: 'CONCEPCION RAMIREZ',
  inquilinoCotitulares: [],
  inquilinoDni: null,
  inquilinoEmail: null,
  inquilinoTelefono: null,
  inquilinoExistenteId: null,
  modalidadAtlas: 'habitual',
  fechaInicio: '2024-01-01',
  fechaFin: '2028-12-31',
  rentaMensual: 330,
  fianza: 330,
  seccion: 'listos',
  motivoSeccion: '',
  decisionDuplicado: null,
  ...overrides,
});

const opciones = [
  { id: 1, label: 'CB Sant Fruitós' },
  { id: 2, label: 'T48' },
];

function renderPaso(drafts: ContractDraft[], onCrear = jest.fn().mockResolvedValue(undefined)) {
  render(
    <PasoRevision
      drafts={drafts}
      inmuebleOpciones={opciones}
      origen="rentila"
      onCrear={onCrear}
      onContinuar={jest.fn()}
      onAtras={jest.fn()}
    />,
  );
  return { onCrear };
}

const tresSecciones = (): ContractDraft[] => [
  baseDraft({ filaOriginal: 2, seccion: 'listos', inmuebleIdConfirmado: 1 }),
  baseDraft({ filaOriginal: 3, seccion: 'listos', inmuebleIdConfirmado: 1, inquilinoNombre: 'JORGE', inquilinoCotitulares: ['SANDRA'] }),
  baseDraft({ filaOriginal: 4, seccion: 'revisar', inmuebleRaw: '01-OVD-NICOLAI', inmuebleIdSugerido: null, inmuebleIdConfirmado: null, inquilinoNombre: 'PEDRO SANTOS' }),
  baseDraft({ filaOriginal: 5, seccion: 'duplicados', inmuebleRaw: '2-MANRESA', inmuebleIdSugerido: 2, inquilinoNombre: 'IVAN GOMEZ', inquilinoExistenteId: 100, motivoSeccion: 'inquilino ya existe DNI 53639208B', decisionDuplicado: 'omitir' }),
];

describe('PasoRevision', () => {
  it('renderiza las 3 secciones con sus contadores', () => {
    renderPaso(tresSecciones());
    expect(screen.getByText('Listos para crear')).toBeInTheDocument();
    expect(screen.getByText('Requieren revisión')).toBeInTheDocument();
    expect(screen.getByText('Posibles duplicados')).toBeInTheDocument();
    // El tooltip discreto "Rentila reconocido".
    expect(screen.getByText('Rentila reconocido')).toBeInTheDocument();
    // El banner SIN FIRMAR.
    expect(screen.getByText(/SIN FIRMAR/)).toBeInTheDocument();
  });

  it('no renderiza secciones vacías', () => {
    renderPaso([baseDraft({ seccion: 'listos' })]);
    expect(screen.getByText('Listos para crear')).toBeInTheDocument();
    expect(screen.queryByText('Requieren revisión')).not.toBeInTheDocument();
    expect(screen.queryByText('Posibles duplicados')).not.toBeInTheDocument();
  });

  it('crear sección Listos · llama onCrear, cierra la sección y habilita continuar', async () => {
    const { onCrear } = renderPaso(tresSecciones());

    const continuar = screen.getByRole('button', { name: /Continuar a resumen/ });
    expect(continuar).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Crear 2 contratos/ }));

    await waitFor(() => expect(onCrear).toHaveBeenCalledTimes(1));
    // onCrear recibió los 2 drafts de la sección listos.
    expect(onCrear.mock.calls[0][0]).toHaveLength(2);

    // La sección desaparece y "Continuar a resumen" se habilita.
    await waitFor(() => expect(screen.queryByText('Listos para crear')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Continuar a resumen/ })).not.toBeDisabled();
  });

  it('sección Revisar · botón disabled hasta resolver el inmueble', async () => {
    renderPaso(tresSecciones());

    const crearRevisar = screen.getByRole('button', { name: /Crear 1 contratos/ });
    expect(crearRevisar).toBeDisabled();

    // Elegir un inmueble en el select de la fila.
    await userEvent.selectOptions(screen.getByLabelText('Inmueble para 01-OVD-NICOLAI'), '2');

    expect(screen.getByRole('button', { name: /Crear 1 contratos/ })).not.toBeDisabled();
  });

  it('sección Duplicados · aplicar decisiones llama onCrear', async () => {
    const { onCrear } = renderPaso(tresSecciones());

    await userEvent.click(screen.getByRole('button', { name: /Aplicar decisiones/ }));

    await waitFor(() => expect(onCrear).toHaveBeenCalledTimes(1));
    expect(onCrear.mock.calls[0][0]).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText('Posibles duplicados')).not.toBeInTheDocument());
  });
});
