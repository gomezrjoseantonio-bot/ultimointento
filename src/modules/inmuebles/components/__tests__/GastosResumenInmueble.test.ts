/**
 * Tests unitarios de `calcularResumenGastosInmueble` y del componente
 * `GastosResumenInmueble`.
 *
 * Cubre:
 * - suma separada de previsto y real
 * - cada grupo visual
 * - mejoras y mobiliario no mezclados con explotación
 * - inmueble sin datos
 * - compromiso de otro inmueble excluido
 * - año seleccionado aplicado a gastos reales
 */
import {
  calcularResumenGastosInmueble,
  construirListaVisualGastosInmueble,
  type GastoInmuebleVisual,
} from '../../adapters/gastosInmuebleAdapter';
import type { CompromisoRecurrente, ImporteEvento, PatronRecurrente } from '../../../../types/compromisosRecurrentes';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../../services/db';

// ─── Helpers de fixtures ──────────────────────────────────────────────────

const patronMensual: PatronRecurrente = { tipo: 'mensualDiaFijo', dia: 5 };
const importeFijo = (importe: number): ImporteEvento => ({ modo: 'fijo', importe });

function crearCompromiso(
  parcial: Partial<CompromisoRecurrente> = {},
): CompromisoRecurrente {
  return {
    id: 1,
    ambito: 'inmueble',
    inmuebleId: 10,
    alias: 'Compromiso test',
    tipo: 'otros',
    subtipo: 'otros',
    proveedor: { nombre: 'Proveedor' },
    patron: patronMensual,
    importe: importeFijo(100),
    categoria: 'inmueble.otros',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    cuentaCargo: 1,
    conceptoBancario: 'TEST',
    metodoPago: 'domiciliacion',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearGastoReal(parcial: Partial<GastoInmueble> = {}): GastoInmueble {
  return {
    id: 201,
    inmuebleId: 10,
    ejercicio: 2026,
    fecha: '2026-01-10',
    concepto: 'Gasto real',
    categoria: 'servicio',
    casillaAEAT: '0108',
    importe: 80,
    origen: 'manual',
    estado: 'confirmado',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...parcial,
  };
}

function crearMejora(parcial: Partial<MejoraInmueble> = {}): MejoraInmueble {
  return {
    id: 301,
    inmuebleId: 10,
    ejercicio: 2026,
    descripcion: 'Mejora',
    tipo: 'mejora',
    importe: 1500,
    fecha: '2026-02-01',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearMueble(parcial: Partial<MuebleInmueble> = {}): MuebleInmueble {
  return {
    id: 401,
    inmuebleId: 10,
    ejercicio: 2026,
    descripcion: 'Mueble',
    fechaAlta: '2026-03-01',
    importe: 500,
    vidaUtil: 10,
    activo: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...parcial,
  };
}

// ─── calcularResumenGastosInmueble ───────────────────────────────────────

describe('calcularResumenGastosInmueble', () => {
  it('devuelve resumen vacío con lista vacía', () => {
    const resumen = calcularResumenGastosInmueble([]);
    expect(resumen.mantener.previsto).toBeUndefined();
    expect(resumen.mantener.real).toBeUndefined();
    expect(resumen.explotar.previsto).toBeUndefined();
    expect(resumen.explotar.real).toBeUndefined();
    expect(resumen.mejorar.real).toBeUndefined();
    expect(resumen.mobiliario.real).toBeUndefined();
    expect(resumen.total.previstoRecurrente).toBeUndefined();
    expect(resumen.total.realOrdinario).toBeUndefined();
  });

  it('separa previsto (recurrente) de real: nunca mezcla ambos en el mismo campo', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [
        crearCompromiso({ id: 1, inmuebleId: 10, concepto: 'ibi', importe: importeFijo(270) }),
      ],
      gastosReales: [
        crearGastoReal({ id: 201, inmuebleId: 10, categoryKey: 'ibi_inmueble', importe: 250 }),
      ],
    });

    const resumen = calcularResumenGastosInmueble(lista);

    // previsto solo de recurrente
    expect(resumen.mantener.previsto).toBe(270);
    // real solo de registro real
    expect(resumen.mantener.real).toBe(250);
  });

  it('clasifica IBI como mantener y suministro como explotar por separado', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [
        crearCompromiso({ id: 1, inmuebleId: 10, concepto: 'ibi', importe: importeFijo(260) }),
        crearCompromiso({ id: 2, inmuebleId: 10, concepto: 'luz', importe: importeFijo(90) }),
      ],
    });

    const resumen = calcularResumenGastosInmueble(lista);

    expect(resumen.mantener.previsto).toBe(260);
    expect(resumen.explotar.previsto).toBe(90);
  });

  it('mejoras y mobiliario van a sus propios grupos, no a explotar', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      mejoras: [crearMejora({ id: 301, inmuebleId: 10, importe: 2000, categoryKey: 'mejora_inmueble' })],
      mobiliario: [crearMueble({ id: 401, inmuebleId: 10, importe: 600, categoryKey: 'mobiliario_inmueble' })],
    });

    const resumen = calcularResumenGastosInmueble(lista);

    expect(resumen.mejorar.real).toBe(2000);
    expect(resumen.mobiliario.real).toBe(600);
    expect(resumen.explotar.real).toBeUndefined();
    expect(resumen.total.mejoras).toBe(2000);
    expect(resumen.total.mobiliarioReal).toBe(600);
  });

  it('excluye gastos reales de otro ejercicio cuando se filtra por año', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      gastosReales: [
        crearGastoReal({ id: 201, inmuebleId: 10, ejercicio: 2025, categoryKey: 'suministro_inmueble', importe: 100 }),
        crearGastoReal({ id: 202, inmuebleId: 10, ejercicio: 2026, categoryKey: 'suministro_inmueble', importe: 80 }),
      ],
    });

    const resumenFiltrado = calcularResumenGastosInmueble(lista, 2026);

    // Solo el de 2026
    expect(resumenFiltrado.explotar.real).toBe(80);
  });

  it('incluye gastos reales sin ejercicio definido aunque se filtre por año', () => {
    // Los registros sin ejercicio no se excluyen porque no se puede determinar su año
    const item: GastoInmuebleVisual = {
      idVisual: 'real:999',
      origen: 'real',
      inmuebleId: 10,
      fecha: '2026-05-01',
      descripcion: 'Sin ejercicio',
      grupoVisual: 'explotar',
      importeReal: 50,
    };

    const resumen = calcularResumenGastosInmueble([item], 2026);

    expect(resumen.explotar.real).toBe(50);
  });

  it('suma correctamente varios compromisos del mismo grupo', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [
        crearCompromiso({ id: 1, inmuebleId: 10, concepto: 'comunidad_ordinaria', importe: importeFijo(100) }),
        crearCompromiso({ id: 2, inmuebleId: 10, concepto: 'ibi', importe: importeFijo(40) }),
      ],
    });

    const resumen = calcularResumenGastosInmueble(lista);
    expect(resumen.mantener.previsto).toBe(140);
  });

  it('total.previstoRecurrente suma mantener + explotar', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [
        crearCompromiso({ id: 1, inmuebleId: 10, concepto: 'ibi', importe: importeFijo(200) }),
        crearCompromiso({ id: 2, inmuebleId: 10, concepto: 'luz', importe: importeFijo(90) }),
      ],
    });

    const resumen = calcularResumenGastosInmueble(lista);
    expect(resumen.total.previstoRecurrente).toBe(290);
  });

  it('compromiso de otro inmueble queda excluido al construir la lista', () => {
    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [
        crearCompromiso({ id: 1, inmuebleId: 10, concepto: 'ibi', importe: importeFijo(200) }),
        crearCompromiso({ id: 2, inmuebleId: 99, concepto: 'ibi', importe: importeFijo(300) }),
      ],
    });

    const resumen = calcularResumenGastosInmueble(lista);
    // Solo inmueble 10: 200
    expect(resumen.mantener.previsto).toBe(200);
  });
});
