// REORG Contratos · Commit 6 · tests de las 3 variantes del drawer ficha.
import {
  DRAWER_LABEL,
  accionPrincipalPorEstado,
} from '../DrawerFichaContrato';

describe('DrawerFichaContrato · variantes por estado efectivo', () => {
  it('etiqueta del hero por estado', () => {
    expect(DRAWER_LABEL.vigente).toMatch(/vigente/i);
    expect(DRAWER_LABEL.proximo).toMatch(/aún no empieza/i);
    expect(DRAWER_LABEL.finalizado).toMatch(/finalizado/i);
  });

  it('finalizado → Reactivar contrato (rotate), independientemente del chip', () => {
    const a = accionPrincipalPorEstado('finalizado', 'al-dia', true);
    expect(a.label).toBe('Reactivar contrato');
    expect(a.icon).toBe('rotate');
  });

  it('proximo sin firmar → Enviar a firma (send)', () => {
    const a = accionPrincipalPorEstado('proximo', 'sin-firmar', false);
    expect(a.label).toBe('Enviar a firma');
    expect(a.icon).toBe('send');
  });

  it('proximo firmado → Editar contrato', () => {
    const a = accionPrincipalPorEstado('proximo', 'al-dia', true);
    expect(a.label).toBe('Editar contrato');
    expect(a.icon).toBe('refresh');
  });

  it('vigente · al-dia → Renovar · impago → Reclamar · vence-30d → Proponer', () => {
    expect(accionPrincipalPorEstado('vigente', 'al-dia', true).label).toBe('Renovar');
    expect(accionPrincipalPorEstado('vigente', 'impago', true).label).toBe('Reclamar cobro');
    expect(accionPrincipalPorEstado('vigente', 'vence-30d', true).label).toBe('Proponer renovación');
  });

  it('vigente · sin-firmar → Enviar a firma (send)', () => {
    const a = accionPrincipalPorEstado('vigente', 'sin-firmar', false);
    expect(a.label).toBe('Enviar a firma');
    expect(a.icon).toBe('send');
  });
});
