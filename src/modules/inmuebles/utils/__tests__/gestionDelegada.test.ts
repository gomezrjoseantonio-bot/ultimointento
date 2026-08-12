import {
  esContratoGestion,
  esSubcontratoAnexado,
  cuentaEnOperativo,
} from '../gestionDelegada';
import type { Contract } from '../../../../services/db';

const base = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
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
});
