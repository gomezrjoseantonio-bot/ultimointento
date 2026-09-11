// E2.4.2-fix2 · «resuelto = tiene sus 4 ejes puestos» · el criterio (D1)

import { avisoDeClasificacion, estaClasificada, etiquetaDeClasificacion } from '../clasificada';
import type { ClasificacionLinea } from '../tipos';

const c = (over: Partial<ClasificacionLinea>): ClasificacionLinea =>
  ({ naturaleza: 'gasto', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto' }, motivos: [], ...over }) as ClasificacionLinea;

describe('estaClasificada · D1', () => {
  it('una familia por concepto, identificador o regla aprendida · sí', () => {
    for (const origen of ['concepto', 'identificador', 'aprendida'] as const) {
      expect(estaClasificada(c({ familia: 'gestion', subtipo: 'gestoria', origen: { naturaleza: 'defecto', ambito: 'defecto', familia: origen } }))).toBe(true);
    }
  });
  it('un ingreso solo por el signo, sin familia · NO', () => {
    expect(estaClasificada(c({ naturaleza: 'ingreso' }))).toBe(false);
  });
  it('una familia por recurrencia · no resuelve, propone', () => {
    expect(estaClasificada(c({ familia: 'suministro', origen: { naturaleza: 'defecto', ambito: 'defecto', familia: 'recurrencia' } }))).toBe(false);
  });
  it('un movimiento interno que no venga del defecto · sí', () => {
    expect(estaClasificada(c({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', origen: { naturaleza: 'concepto', ambito: 'defecto', familia: 'concepto' } }))).toBe(true);
    expect(estaClasificada(c({ naturaleza: 'movimiento_interno', origen: { naturaleza: 'defecto', ambito: 'defecto' } }))).toBe(false);
  });
  it('sin clasificación · no', () => {
    expect(estaClasificada(undefined)).toBe(false);
  });
});

describe('etiquetaDeClasificacion · lo que se lee', () => {
  it('naturaleza · familia · subtipo', () => {
    expect(etiquetaDeClasificacion(c({ familia: 'gestion', subtipo: 'gestoria' }))).toBe('Gasto · Gestión · Gestoría');
  });
  it('un traspaso no repite «movimiento interno» delante', () => {
    expect(etiquetaDeClasificacion(c({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro' }))).toBe('Traspaso · A ahorro');
  });
  it('sin familia · solo la naturaleza', () => {
    expect(etiquetaDeClasificacion(c({ naturaleza: 'ingreso' }))).toBe('Ingreso');
  });
});

describe('avisoDeClasificacion · por qué se queda sin clasificar', () => {
  it('el IVA dice lo suyo', () => {
    const aviso = 'movimiento con Hacienda · IVA (modelo 303) · dinero de paso, no un gasto · se decide en la fase de autónomo';
    expect(avisoDeClasificacion(c({ motivos: [aviso] }))).toBe(aviso);
  });
  it('sin señal no hay aviso · y una clasificada tampoco', () => {
    expect(avisoDeClasificacion(c({ motivos: ['sin señal · naturaleza por el signo, personal por defecto'] }))).toBeNull();
    expect(avisoDeClasificacion(c({ familia: 'gestion', origen: { naturaleza: 'defecto', ambito: 'defecto', familia: 'concepto' }, motivos: ['«gestoria» en el concepto'] }))).toBeNull();
  });
});
