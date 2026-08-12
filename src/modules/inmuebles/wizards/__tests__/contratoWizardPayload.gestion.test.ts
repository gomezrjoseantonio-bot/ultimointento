import { construirPayloadCompleto, construirPayloadBorrador } from '../contratoWizardPayload';
import { emptyForm, type FormState } from '../contratoWizardHelpers';

const formCompleto = (over: Partial<FormState> = {}): FormState => ({
  ...emptyForm,
  inmuebleId: 1,
  modalidad: 'habitual',
  fechaInicio: '2026-01-01',
  fechaFin: '2027-01-01',
  inquilinoEmail: 'i@v.es',
  inquilinoTelefono: '600',
  rentaMensual: '600',
  cuentaCobroId: '7',
  ...over,
});

describe('contratoWizardPayload · anexado (gestionPadreId)', () => {
  it('construirPayloadCompleto · sin gestionPadreId no añade el campo', () => {
    const res = construirPayloadCompleto(formCompleto());
    expect(res.ok).toBe(true);
    if (res.ok) expect('gestionPadreId' in res.payload).toBe(false);
  });

  it('construirPayloadCompleto · con gestionPadreId lo fija en el payload', () => {
    const res = construirPayloadCompleto(formCompleto(), 42);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.gestionPadreId).toBe(42);
  });

  it('construirPayloadBorrador · con gestionPadreId lo fija (subcontrato a medias)', () => {
    const payload = construirPayloadBorrador(formCompleto({ inquilinoTelefono: '', inquilinoEmail: '' }), 42);
    expect(payload.gestionPadreId).toBe(42);
    expect(payload.estadoContrato).toBe('sin_firmar');
  });
});
