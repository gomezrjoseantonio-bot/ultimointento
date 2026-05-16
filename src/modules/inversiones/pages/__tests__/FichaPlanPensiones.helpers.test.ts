// TAREA 13 v4 · Acción 3 · tests del helper `getFechaMinimaRescate`.
//
// El helper convive con la ficha (componente UI) · solo testamos la lógica
// pura · sin render.

import { getFechaMinimaRescate } from '../FichaPlanPensiones';

describe('getFechaMinimaRescate', () => {
  it('PPI · 2016-03-15 · primera ventana 2026-03-15 · copy "+10 años" · fecha civil estable UTC', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPI',
      fechaContratacion: '2016-03-15',
    });
    expect(r.tipo).toBe('fecha');
    // Aritmética UTC · no debe shiftearse por timezone.
    expect(r.fechaPrimeraVentana).toBe('2026-03-15');
    // Copy formatea día/mes/año estable.
    expect(r.descripcion).toContain('15/03/2026');
    expect(r.descripcion).toContain('+10 años');
    expect(r.descripcion).toContain('RD-Ley 1/2015');
    expect(r.supuestosLegales).toBeUndefined();
  });

  it('PPA · regla 10 años igual que PPI · primera ventana 2030-01-01', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPA',
      fechaContratacion: '2020-01-01',
    });
    expect(r.tipo).toBe('fecha');
    expect(r.fechaPrimeraVentana).toBe('2030-01-01');
    expect(r.descripcion).toContain('01/01/2030');
  });

  it('PPI antiguo (2010) · clamp a 2025-01-01 · fecha legal de entrada en vigor', () => {
    // Plan contratado en 2010 · fechaContratacion + 10 años = 2020-06-15, pero
    // el derecho de rescate por antigüedad solo aplica desde 1-ene-2025
    // (RD-Ley 1/2015 disp. final 1ª). Mostrar 2020 sería un dato imposible.
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPI',
      fechaContratacion: '2010-06-15',
    });
    expect(r.tipo).toBe('fecha');
    expect(r.fechaPrimeraVentana).toBe('2025-01-01');
    expect(r.descripcion).toContain('01/01/2025');
  });

  it('PPI contratado el día exacto que cumple el clamp (2015-01-01) · usa fecha + 10 años (2025-01-01)', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPI',
      fechaContratacion: '2015-01-01',
    });
    expect(r.tipo).toBe('fecha');
    expect(r.fechaPrimeraVentana).toBe('2025-01-01');
  });

  it('PPE · supuestos legales · sin fecha concreta', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPE',
      fechaContratacion: '2020-01-01',
    });
    expect(r.tipo).toBe('supuestos');
    expect(r.fechaPrimeraVentana).toBeUndefined();
    expect(r.supuestosLegales).toEqual(
      expect.arrayContaining(['Jubilación', 'Incapacidad permanente', 'Fallecimiento del partícipe (beneficiarios)']),
    );
    expect(r.descripcion).toContain('supuesto legal');
  });

  it('PPES · supuestos legales igual que PPE', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPES',
      fechaContratacion: '2022-06-01',
    });
    expect(r.tipo).toBe('supuestos');
    expect(r.supuestosLegales).toBeDefined();
    expect(r.supuestosLegales!.length).toBeGreaterThan(0);
  });

  it('fecha de contratación inválida · cae a copy genérico sin fechaPrimeraVentana', () => {
    const r = getFechaMinimaRescate({
      tipoAdministrativo: 'PPI',
      fechaContratacion: 'fecha-mala',
    });
    expect(r.tipo).toBe('fecha');
    expect(r.fechaPrimeraVentana).toBeUndefined();
    expect(r.descripcion).toContain('10 años');
  });
});
