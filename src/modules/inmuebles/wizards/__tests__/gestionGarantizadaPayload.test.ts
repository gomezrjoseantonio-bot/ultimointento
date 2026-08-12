import { construirPayloadGestion, type GestionForm } from '../gestionGarantizadaPayload';

const formValido = (over: Partial<GestionForm> = {}): GestionForm => ({
  inmuebleId: 1,
  agenciaNombre: 'Agencia XYZ',
  agenciaNif: 'B12345678',
  comisionTipo: 'garantizada',
  liquidacion: 'agencia_neto',
  rentaGarantizada: '1350',
  comisionPorcentaje: '',
  feeHabitacion: '',
  feeFijo: '',
  fianza: '',
  indexacion: 'ipc',
  indexacionFormula: '',
  fechaInicio: '2026-01-01',
  fechaFin: '2029-01-01', // plazo pactado a 3 años
  diaPago: '1',
  cuentaCobroId: '7',
  ...over,
});

describe('construirPayloadGestion', () => {
  it('construye el contrato de gestión (padre) NO-LAU con el bloque gestion', () => {
    const res = construirPayloadGestion(formValido());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.payload;
    expect(p.rentaMensual).toBe(1350);
    expect(p.indexacion).toBe('ipc');
    expect(p.estadoContrato).toBe('activo');
    expect(p.fianzaMeses).toBe(0); // sin fianza LAU
    expect(p.cuentaCobroId).toBe(7);
    expect(p.gestion).toMatchObject({
      agenciaNif: 'B12345678',
      modeloIngreso: 'garantizada',
      rentaGarantizada: 1350,
      honorarios: [],
      liquidacion: 'agencia_neto',
      comisionTipo: 'garantizada',
    });
    expect(p.inquilino.nombre).toBe('Agencia XYZ');
    expect(p.inquilino.dni).toBe('B12345678');
  });

  it('comisión por porcentaje · rentaMensual 0 + comisionTipo/porcentaje en gestion', () => {
    const res = construirPayloadGestion(
      formValido({ comisionTipo: 'porcentaje', rentaGarantizada: '', comisionPorcentaje: '10' }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.rentaMensual).toBe(0);
    expect(res.payload.gestion).toMatchObject({
      modeloIngreso: 'traspaso',
      comisionTipo: 'porcentaje',
      comisionPorcentaje: 10,
    });
  });

  it('porcentaje · exige % entre 0 y 100', () => {
    expect(construirPayloadGestion(formValido({ comisionTipo: 'porcentaje', comisionPorcentaje: '0' }))).toMatchObject({ ok: false });
    expect(construirPayloadGestion(formValido({ comisionTipo: 'porcentaje', comisionPorcentaje: '150' }))).toMatchObject({ ok: false });
  });

  it('comisión por fees · construye honorarios desde fee habitación y fee fijo', () => {
    const res = construirPayloadGestion(
      formValido({ comisionTipo: 'fees', rentaGarantizada: '', feeHabitacion: '50', feeFijo: '20' }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.gestion?.comisionTipo).toBe('fees');
    expect(res.payload.gestion?.honorarios).toEqual([
      { concepto: 'fee_habitacion', calculo: 'importe', base: 'habitacion', valor: 50, periodicidad: 'mensual' },
      { concepto: 'fee_fijo', calculo: 'importe', base: 'fijo', valor: 20, periodicidad: 'mensual' },
    ]);
  });

  it('fees · exige al menos un honorario', () => {
    expect(
      construirPayloadGestion(formValido({ comisionTipo: 'fees', rentaGarantizada: '', feeHabitacion: '', feeFijo: '' })),
    ).toMatchObject({ ok: false });
  });

  it('NO-LAU · respeta la fecha de fin pactada, sin recalcularla (+5)', () => {
    const res = construirPayloadGestion(formValido({ fechaInicio: '2026-01-01', fechaFin: '2027-06-30' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.fechaFin).toBe('2027-06-30');
  });

  it('indexación "otros" · exige fórmula y la guarda en indexOtros', () => {
    expect(
      construirPayloadGestion(formValido({ indexacion: 'otros', indexacionFormula: '' })),
    ).toMatchObject({ ok: false });

    const res = construirPayloadGestion(
      formValido({ indexacion: 'otros', indexacionFormula: 'IPC + 1%' }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.indexacion).toBe('otros');
    expect(res.payload.indexOtros).toEqual({ formula: 'IPC + 1%', frecuencia: 'anual' });
  });

  it('fianza · opcional (0 por defecto) · se guarda en fianzaImporte si se indica', () => {
    const sinFianza = construirPayloadGestion(formValido({ fianza: '' }));
    expect(sinFianza.ok).toBe(true);
    if (sinFianza.ok) expect(sinFianza.payload.fianzaImporte).toBe(0);

    const conFianza = construirPayloadGestion(formValido({ fianza: '2700' }));
    expect(conFianza.ok).toBe(true);
    if (conFianza.ok) expect(conFianza.payload.fianzaImporte).toBe(2700);

    expect(construirPayloadGestion(formValido({ fianza: '-100' }))).toMatchObject({ ok: false });
  });

  it('sin indexación · no añade indexOtros', () => {
    const res = construirPayloadGestion(formValido({ indexacion: 'none' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.indexOtros).toBeUndefined();
  });

  it('exige inmueble', () => {
    expect(construirPayloadGestion(formValido({ inmuebleId: null }))).toEqual({
      ok: false,
      error: 'Debe seleccionar un inmueble',
    });
  });

  it('exige nombre y NIF de la agencia', () => {
    expect(construirPayloadGestion(formValido({ agenciaNombre: '  ' }))).toMatchObject({ ok: false });
    expect(construirPayloadGestion(formValido({ agenciaNif: '' }))).toMatchObject({ ok: false });
  });

  it('exige renta garantizada > 0', () => {
    expect(construirPayloadGestion(formValido({ rentaGarantizada: '0' }))).toMatchObject({ ok: false });
    expect(construirPayloadGestion(formValido({ rentaGarantizada: '' }))).toMatchObject({ ok: false });
  });

  it('exige fecha de fin (plazo pactado) posterior al inicio', () => {
    expect(
      construirPayloadGestion(formValido({ fechaInicio: '2026-01-01', fechaFin: '' })),
    ).toMatchObject({ ok: false });
    expect(
      construirPayloadGestion(formValido({ fechaInicio: '2026-01-01', fechaFin: '2025-01-01' })),
    ).toMatchObject({ ok: false });
  });

  it('exige cuenta de cobro', () => {
    expect(construirPayloadGestion(formValido({ cuentaCobroId: '' }))).toMatchObject({ ok: false });
  });
});
