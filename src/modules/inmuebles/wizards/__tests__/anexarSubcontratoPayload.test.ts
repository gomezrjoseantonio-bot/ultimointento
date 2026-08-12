import { construirPayloadSubcontrato, type AnexarSubcontratoForm } from '../anexarSubcontratoPayload';
import type { Contract } from '../../../../services/db';

const padre = {
  id: 1,
  inmuebleId: 9,
  diaPago: 5,
  gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
} as unknown as Contract & { id: number };

const form = (over: Partial<AnexarSubcontratoForm> = {}): AnexarSubcontratoForm => ({
  nombre: 'Ana',
  apellidos: 'García',
  habitacionId: '',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  rentaMensual: '600',
  ...over,
});

describe('construirPayloadSubcontrato', () => {
  it('crea un subcontrato mínimo anexado al padre · sin fianza/cuenta/firma', () => {
    const res = construirPayloadSubcontrato(form(), padre);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.payload;
    expect(p.gestionPadreId).toBe(1);
    expect(p.inmuebleId).toBe(9);
    expect(p.rentaMensual).toBe(600);
    expect(p.diaPago).toBe(5); // hereda del padre
    expect(p.inquilino).toEqual({ nombre: 'Ana', apellidos: 'García', dni: '', telefono: '', email: '' });
    expect(p.fianzaImporte).toBe(0);
    expect(p.cuentaCobroId).toBe(0);
    expect(p.unidadTipo).toBe('vivienda');
  });

  it('con habitación · unidadTipo habitacion + habitacionId', () => {
    const res = construirPayloadSubcontrato(form({ habitacionId: 'H2' }), padre);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.unidadTipo).toBe('habitacion');
    expect(res.payload.habitacionId).toBe('H2');
  });

  it('exige nombre', () => {
    expect(construirPayloadSubcontrato(form({ nombre: '  ' }), padre)).toMatchObject({ ok: false });
  });

  it('exige renta > 0', () => {
    expect(construirPayloadSubcontrato(form({ rentaMensual: '0' }), padre)).toMatchObject({ ok: false });
  });

  it('exige fechas coherentes', () => {
    expect(construirPayloadSubcontrato(form({ fechaInicio: '' }), padre)).toMatchObject({ ok: false });
    expect(
      construirPayloadSubcontrato(form({ fechaInicio: '2026-06-01', fechaFin: '2026-01-01' }), padre),
    ).toMatchObject({ ok: false });
  });
});
