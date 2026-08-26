import {
  esContratoGestion,
  esSubcontratoAnexado,
  cuentaEnOperativo,
  agruparSubcontratosPorPadre,
} from '../gestionDelegada';
import type { Contract } from '../../../../services/db';

const base = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: { nombre: 'A', apellidos: 'B', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

describe('gestionDelegada · predicados de dominio', () => {
  it('contrato normal · ni gestión ni subcontrato · cuenta en operativo', () => {
    const c = base({});
    expect(esContratoGestion(c)).toBe(false);
    expect(esSubcontratoAnexado(c)).toBe(false);
    expect(cuentaEnOperativo(c)).toBe(true);
  });

  it('contrato de gestión (padre) · lleva bloque gestion · cuenta en operativo', () => {
    const c = base({
      gestion: { agenciaNif: 'B12345678', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
    });
    expect(esContratoGestion(c)).toBe(true);
    expect(esSubcontratoAnexado(c)).toBe(false);
    expect(cuentaEnOperativo(c)).toBe(true); // el padre es el operativo del piso
  });

  it('subcontrato anexado (hijo) · lleva gestionPadreId · NO cuenta en operativo', () => {
    const c = base({ gestionPadreId: 7 });
    expect(esContratoGestion(c)).toBe(false);
    expect(esSubcontratoAnexado(c)).toBe(true);
    expect(cuentaEnOperativo(c)).toBe(false); // es fiscal, fuera del operativo
  });

  it('agruparSubcontratosPorPadre · agrupa los hijos por su padre', () => {
    const contracts = [
      base({ id: 1, gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] } }),
      base({ id: 2, gestionPadreId: 1 }),
      base({ id: 3, gestionPadreId: 1 }),
      base({ id: 4, gestionPadreId: 5 }),
      base({ id: 6 }), // normal · no entra
    ];
    const map = agruparSubcontratosPorPadre(contracts);
    expect(map.get(1)?.map((c) => c.id)).toEqual([2, 3]);
    expect(map.get(5)?.map((c) => c.id)).toEqual([4]);
    expect(map.has(6)).toBe(false);
  });
});
