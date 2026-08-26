// Lo que el usuario elige en el selector tiene que llegar al contrato guardado.
//
// Es el eslabón entre la pantalla y el motor: sin él, el selector sería un
// adorno —el usuario pacta 565 € y ATLAS emitiría los 200,16 aritméticos—.

import { construirPayloadCompleto, construirPayloadBorrador } from '../contratoWizardPayload';
import { emptyForm, type FormState } from '../contratoWizardHelpers';

const formValido = (extra?: Partial<FormState>): FormState => ({
  ...emptyForm,
  inmuebleId: 1,
  fechaInicio: '2026-08-15',
  fechaFin: '2031-08-14',
  inquilinoNombre: 'Adnan',
  inquilinoApellidos: 'Parwez Khan',
  inquilinoNif: '53069494F',
  inquilinoEmail: 'adnan@example.com',
  inquilinoTelefono: '600000000',
  rentaMensual: '365',
  diaPago: '1',
  fianzaMensualidades: '1',
  cuentaCobroId: '1',
  ...extra,
});

describe('el primer cobro pactado viaja del wizard al contrato', () => {
  it('alta completa · guarda modo e importe tal cual se eligieron', () => {
    const res = construirPayloadCompleto(
      formValido({ primerCobro: { modo: 'dias_mas_adelanto', importe: 565 } }),
    );

    expect(res.ok).toBe(true);
    expect(res.ok && res.payload.primerCobro).toEqual({
      modo: 'dias_mas_adelanto',
      importe: 565,
    });
  });

  it('borrador · también lo conserva, para poder retomarlo', () => {
    const payload = construirPayloadBorrador(
      formValido({ primerCobro: { modo: 'manual', importe: 500 } }),
    );

    expect(payload.primerCobro).toEqual({ modo: 'manual', importe: 500 });
  });

  it('sin tocar el selector no se inventa nada · el motor prorratea', () => {
    const res = construirPayloadCompleto(formValido());

    expect(res.ok).toBe(true);
    expect(res.ok && res.payload.primerCobro).toBeUndefined();
  });
});
