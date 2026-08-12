import { construirPayloadGestionGarantizada, type GestionGarantizadaForm } from '../gestionGarantizadaPayload';

const formValido = (over: Partial<GestionGarantizadaForm> = {}): GestionGarantizadaForm => ({
  inmuebleId: 1,
  agenciaNombre: 'Agencia XYZ',
  agenciaNif: 'B12345678',
  rentaGarantizada: '1350',
  indexacion: 'ipc',
  fechaInicio: '2026-01-01',
  fechaFin: '2029-01-01', // plazo pactado a 3 años
  diaPago: '1',
  cuentaCobroId: '7',
  ...over,
});

describe('construirPayloadGestionGarantizada', () => {
  it('construye el contrato de gestión (padre) NO-LAU con el bloque gestion', () => {
    const res = construirPayloadGestionGarantizada(formValido());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.payload;
    expect(p.rentaMensual).toBe(1350);
    expect(p.indexacion).toBe('ipc');
    expect(p.estadoContrato).toBe('activo');
    expect(p.fianzaMeses).toBe(0); // sin fianza LAU
    expect(p.cuentaCobroId).toBe(7);
    expect(p.gestion).toEqual({
      agenciaNif: 'B12345678',
      modeloIngreso: 'garantizada',
      rentaGarantizada: 1350,
      honorarios: [],
    });
    // La agencia queda como contraparte para que el operativo la reconozca.
    expect(p.inquilino.nombre).toBe('Agencia XYZ');
    expect(p.inquilino.dni).toBe('B12345678');
  });

  it('NO-LAU · respeta la fecha de fin pactada, sin recalcularla (+5)', () => {
    const res = construirPayloadGestionGarantizada(formValido({ fechaInicio: '2026-01-01', fechaFin: '2027-06-30' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.fechaFin).toBe('2027-06-30'); // tal cual, no 2031
  });

  it('exige inmueble', () => {
    const res = construirPayloadGestionGarantizada(formValido({ inmuebleId: null }));
    expect(res).toEqual({ ok: false, error: 'Debe seleccionar un inmueble' });
  });

  it('exige nombre y NIF de la agencia', () => {
    expect(construirPayloadGestionGarantizada(formValido({ agenciaNombre: '  ' }))).toMatchObject({ ok: false });
    expect(construirPayloadGestionGarantizada(formValido({ agenciaNif: '' }))).toMatchObject({ ok: false });
  });

  it('exige renta garantizada > 0', () => {
    expect(construirPayloadGestionGarantizada(formValido({ rentaGarantizada: '0' }))).toMatchObject({ ok: false });
    expect(construirPayloadGestionGarantizada(formValido({ rentaGarantizada: '' }))).toMatchObject({ ok: false });
  });

  it('exige fecha de fin (plazo pactado) posterior al inicio', () => {
    expect(
      construirPayloadGestionGarantizada(formValido({ fechaInicio: '2026-01-01', fechaFin: '' })),
    ).toMatchObject({ ok: false });
    expect(
      construirPayloadGestionGarantizada(formValido({ fechaInicio: '2026-01-01', fechaFin: '2025-01-01' })),
    ).toMatchObject({ ok: false });
  });

  it('exige cuenta de cobro', () => {
    expect(construirPayloadGestionGarantizada(formValido({ cuentaCobroId: '' }))).toMatchObject({ ok: false });
  });
});
