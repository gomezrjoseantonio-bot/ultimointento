// Fase E · integración drawer ↔ Tesorería. Siembra un evento de renta VENCIDO
// y SIN cobrar en IndexedDB (fake) y verifica que el drawer eleva el chip a
// "Impago", ofrece la acción "Reclamar cobro" y lista el cobro.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DrawerFichaContrato from '../DrawerFichaContrato';
import type { Contract, TreasuryEvent } from '../../../../../services/db';
import { initDB } from '../../../../../services/db';

const contrato: Contract & { id: number } = {
  id: 4242,
  inmuebleId: 7,
  unidadTipo: 'vivienda',
  modalidad: 'habitual',
  inquilino: { nombre: 'Laura', apellidos: 'Sanz', dni: '99887766X', telefono: '', email: '' },
  fechaInicio: '2020-01-01',
  fechaFin: '2099-12-31',
  rentaMensual: 950,
  diaPago: 5,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 950,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: 'activo',
  firma: { metodo: 'digital', estado: 'firmado' },
} as Contract & { id: number };

const rentaVencidaSinCobrar: Partial<TreasuryEvent> = {
  type: 'income',
  amount: 950,
  // Muy en el pasado → vencida sin cobrar sea cual sea la fecha de hoy → impago.
  predictedDate: '2020-02-05',
  description: 'Renta febrero 2020',
  sourceType: 'contract',
  sourceId: 4242,
  contratoId: 4242,
  status: 'predicted',
};

beforeEach(async () => {
  const db = await initDB();
  await db.add('treasuryEvents', rentaVencidaSinCobrar as TreasuryEvent);
});

describe('DrawerFichaContrato · cobros desde Tesorería (Fase E)', () => {
  it('renta vencida sin cobrar → chip Impago + acción "Reclamar cobro" + fila de cobro', async () => {
    render(
      <DrawerFichaContrato contrato={contrato} inmuebleAlias="Piso Centro" open onClose={() => {}} />,
    );

    // El chip del hero sube a "Impago" tras cargar Tesorería.
    expect(await screen.findByText('Impago')).toBeInTheDocument();
    // La acción primaria pasa a "Reclamar cobro".
    expect(await screen.findByText('Reclamar cobro')).toBeInTheDocument();
    // La lista de cobros muestra el evento (badge "Sin cobrar").
    expect(await screen.findByText('Sin cobrar')).toBeInTheDocument();
    // Ya no aparece el placeholder antiguo.
    expect(screen.queryByText(/Integración con servicio de cobros/)).not.toBeInTheDocument();
  });
});
