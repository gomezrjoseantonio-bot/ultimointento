/**
 * Régimen de atribución de rentas (Comunidad de Bienes) en el flujo de LECTURA de
 * años YA DECLARADOS.
 *
 * La CB importada por XML se guarda en el store `entidadesAtribucion`, pero la
 * pantalla de Fiscalidad, para años declarados, no lee ese store: lee la
 * `DeclaracionCompleta` persistida en el coord y la pasa por este adapter. Si el
 * adapter no proyecta `entidadesAtribucion` como una fila sintética
 * `inmuebleId:-1` en `baseGeneral.rendimientosInmuebles`, `buildSeccionAtribucion`
 * no encuentra nada y el apartado 'AR' nunca se pinta — que era el bug: la CB de
 * 2025 no aparecía en Fiscalidad pese a estar bien importada.
 */
import { declaracionCompletaToIRPF } from '../declaracionCompletaToIRPFAdapter';
import { buildSeccionAtribucion, buildSecciones } from '../../modules/fiscal/v2/helpers/ejercicioCasillasService';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

function declConCB(overrides: Partial<DeclaracionCompleta> = {}): DeclaracionCompleta {
  return {
    meta: {
      ejercicio: 2025, modelo: '100', fechaPresentacion: '', numeroJustificante: '',
      csv: '', referencia: '', fuenteImportacion: 'xml', confianza: 'total',
      esComplementaria: false, esRectificativa: false, tipoDeclaracion: 'I',
    },
    declarante: { nif: '00000000T', nombreCompleto: 'FIXTURE', tributacion: 'individual', asignacionSocial: false, asignacionIglesia: false },
    inmuebles: [],
    integracion: { baseImponibleGeneral: 0, baseImponibleAhorro: 0, reduccionPP: 0, baseLiquidableGeneral: 0, baseLiquidableAhorro: 0, minimoPersonalEstatal: 0, minimoPersonalAutonomico: 0 },
    resultado: { cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: 0, cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: 0, deduccionesAutonomicas: 0, deduccionesEstatales: 0, cuotaAutoliquidacion: 0, totalRetencionesPagos: 0, cuotaDiferencial: 0, resultadoDeclaracion: 0 },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] },
    entidadesAtribucion: [
      { nif: 'E25904640', tipoEntidad: 'CB', porcentajeParticipacion: 10, tipoRenta: 'capital_inmobiliario', rendimientoAtribuido: 1682.8, retencionAtribuida: 136.05 },
    ],
    casillas: {}, camposExtra: {},
    ...overrides,
  } as DeclaracionCompleta;
}

describe('adapter · atribución de rentas (CB) en años declarados', () => {
  it('proyecta entidadesAtribucion de capital inmobiliario como fila inmuebleId:-1', () => {
    const irpf = declaracionCompletaToIRPF(declConCB(), new Map());
    const atrib = irpf.baseGeneral.rendimientosInmuebles.filter((i) => i.inmuebleId === -1);
    expect(atrib).toHaveLength(1);
    expect(atrib[0].rendimientoNetoReducido).toBeCloseTo(1682.8, 2);
  });

  it('la pantalla de Fiscalidad pinta el apartado AR con el importe atribuido', () => {
    const irpf = declaracionCompletaToIRPF(declConCB(), new Map());
    const d: any = { casillas: null, resumen: {}, declaracionCompleta: irpf };
    const sec = buildSeccionAtribucion(d);
    expect(sec).not.toBeNull();
    expect(sec!.total).toBeCloseTo(1682.8, 2);
    expect(buildSecciones(d).secciones.map((s) => s.letter)).toContain('AR');
  });

  it('sin entidades de atribución no se inyecta ninguna fila sintética', () => {
    const irpf = declaracionCompletaToIRPF(declConCB({ entidadesAtribucion: [] }), new Map());
    expect(irpf.baseGeneral.rendimientosInmuebles.some((i) => i.inmuebleId === -1)).toBe(false);
  });

  it('solo atribuye capital inmobiliario, no otras naturalezas de renta', () => {
    const irpf = declaracionCompletaToIRPF(declConCB({
      entidadesAtribucion: [
        { nif: 'E25904640', tipoEntidad: 'CB', porcentajeParticipacion: 10, tipoRenta: 'actividad_economica', rendimientoAtribuido: 5000, retencionAtribuida: 0 },
      ],
    }), new Map());
    expect(irpf.baseGeneral.rendimientosInmuebles.some((i) => i.inmuebleId === -1)).toBe(false);
  });
});
