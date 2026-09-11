// E2.4.2-fix2 · lo que el motor clasificó, visto desde la sesión · quién va a
// «resueltas» y quién viaja al Guardar.

import { clasificadasDe, lineasResueltasPorConcepto } from '../clasificadasPorConcepto';
import { decisionesVacias, type DecisionesSesion, type LineaExtracto } from '../extractoSesion';
import type { ClasificacionLinea } from '../../../../services/clasificacion/tipos';

const clasificada = (familia: 'gestion' | 'traspaso'): ClasificacionLinea =>
  familia === 'traspaso'
    ? ({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', ambito: 'personal', origen: { naturaleza: 'concepto', ambito: 'defecto', familia: 'concepto' }, motivos: ['«ahorro»'] } as ClasificacionLinea)
    : ({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto', familia: 'concepto' }, motivos: ['«finutive»'] } as ClasificacionLinea);

const sinClasificar: ClasificacionLinea = { naturaleza: 'ingreso', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto' }, motivos: [] };

const linea = (id: number, clasificacion?: ClasificacionLinea, over: Partial<LineaExtracto> = {}): LineaExtracto => ({
  lineaId: id, hashLinea: `h${id}`, textoBanco: `L${id}`, fecha: '2025-06-01', importe: -10, veredicto: 'resolver', ...(clasificacion ? { clasificacion } : {}), ...over,
});

describe('clasificadasDe', () => {
  it('solo las que tienen sus ejes puestos', () => {
    const ids = clasificadasDe([linea(1, clasificada('gestion')), linea(2, sinClasificar), linea(3), linea(4, clasificada('traspaso'))]);
    expect([...ids]).toEqual([1, 4]);
  });
});

describe('lineasResueltasPorConcepto · lo que viaja al Guardar', () => {
  const lineas = [linea(1, clasificada('gestion')), linea(2, clasificada('traspaso')), linea(3, clasificada('gestion')), linea(4, clasificada('gestion')), linea(5, sinClasificar)];
  const clasificadas = clasificadasDe(lineas);

  it('las clasificadas que nadie tocó · y no las que ya cerró un libro o una regla', () => {
    expect(lineasResueltasPorConcepto(lineas, decisionesVacias(), clasificadas, new Set([3]), new Set([4]))).toEqual([1, 2]);
  });

  it('«No es esto» la saca · y una decisión del usuario también', () => {
    const d: DecisionesSesion = { ...decisionesVacias(), desemparejados: new Set([1]) };
    d.ignorados.add(2);
    expect(lineasResueltasPorConcepto(lineas, d, clasificadas)).toEqual([3, 4]);
  });
});
