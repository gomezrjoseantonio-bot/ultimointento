// El camino real de la siembra · FASE 2 #4
//
// `catalogoOpexUnaSolaVia` fija el helper puro. Esto comprueba el camino
// entero —el que recorre el modal— porque el bug no estaba en el catálogo:
// estaba en QUÉ se le preguntaba. Con el subtipo saliendo del modo, un
// inmueble de media estancia recibía siete conceptos.

import { conceptosASembrar } from '../sembrarOpexInmueble';
import { getContractsByProperty } from '../../../../services/contractService';
import { listarCompromisos } from '../../../../services/personal/compromisosRecurrentesService';

jest.mock('../../../../services/contractService', () => ({
  getContractsByProperty: jest.fn(),
}));
jest.mock('../../../../services/personal/compromisosRecurrentesService', () => ({
  listarCompromisos: jest.fn(),
  crearCompromiso: jest.fn(),
}));

const HOY = new Date('2026-08-26T00:00:00Z');

const contratoDe = (modalidad: string) => ({
  modalidad,
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
});

// CRA pone `resetMocks: true`, así que las implementaciones se reponen aquí.
const conContratos = (contratos: unknown[], yaDados: unknown[] = []): void => {
  (getContractsByProperty as jest.Mock).mockResolvedValue(contratos);
  (listarCompromisos as jest.Mock).mockResolvedValue(yaDados);
};

describe('conceptosASembrar · el subtipo lo pone el contrato', () => {
  it('MEDIA estancia en un inmueble de modo «completo» · 16, no 7', async () => {
    conContratos([contratoDe('media_estancia')]);
    const refs = await conceptosASembrar(1, 'completo', HOY);
    expect(refs).toHaveLength(16);
  });

  it('CORTA estancia, igual', async () => {
    conContratos([contratoDe('corta_estancia')]);
    expect(await conceptosASembrar(1, 'completo', HOY)).toHaveLength(16);
  });

  it('la licencia turística deja de faltar', async () => {
    conContratos([contratoDe('media_estancia')]);
    const refs = await conceptosASembrar(1, 'completo', HOY);
    expect(refs).toContainEqual({ tipoId: 'tributos', subtipoId: 'licencia_turistica' });
  });

  it('y el seguro de impago deja de sugerirse', async () => {
    conContratos([contratoDe('media_estancia')]);
    const refs = await conceptosASembrar(1, 'completo', HOY);
    expect(refs).not.toContainEqual({ tipoId: 'seguros', subtipoId: 'impago' });
  });

  it('la larga estancia no cambia · 7', async () => {
    conContratos([contratoDe('larga_estancia')]);
    expect(await conceptosASembrar(1, 'completo', HOY)).toHaveLength(7);
  });

  it('la larga por habitaciones tampoco · 13', async () => {
    conContratos([contratoDe('larga_estancia')]);
    expect(await conceptosASembrar(1, 'habitaciones', HOY)).toHaveLength(13);
  });

  it('sin contratos todavía, manda el modo · un turístico recién marcado recibe los suyos', async () => {
    conContratos([]);
    expect(await conceptosASembrar(1, 'turistico', HOY)).toHaveLength(16);
    conContratos([]);
    expect(await conceptosASembrar(1, 'completo', HOY)).toHaveLength(7);
  });

  it('lo que ya está dado de alta no se vuelve a ofrecer', async () => {
    conContratos([contratoDe('media_estancia')], [{ tipoFamilia: 'tributos', subtipo: 'ibi' }]);
    const refs = await conceptosASembrar(1, 'completo', HOY);
    expect(refs).toHaveLength(15);
    expect(refs).not.toContainEqual({ tipoId: 'tributos', subtipoId: 'ibi' });
  });

  it('pregunta por los contratos DE ESE inmueble', async () => {
    conContratos([contratoDe('media_estancia')]);
    await conceptosASembrar(42, 'completo', HOY);
    expect(getContractsByProperty).toHaveBeenCalledWith(42);
  });
});
