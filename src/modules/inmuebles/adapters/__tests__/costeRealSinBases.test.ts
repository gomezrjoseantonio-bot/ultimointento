import {
  construirListaVisualGastosInmueble,
  esCosteRealDelAnioInmueble,
  type GastoInmuebleVisual,
} from '../gastosInmuebleAdapter';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../../services/db';

/**
 * El «coste real del año» de la pestaña Costes no debe incluir conceptos que la
 * declaración AEAT trae pero que NO son un gasto del ejercicio:
 *   - casilla 0130 (base de amortización) → valor amortizable, no un desembolso.
 *   - casilla 0129 (mejoras del ejercicio) → duplica la mejora ya registrada.
 *   - alta patrimonial de mobiliario → es un activo; su coste anual es la
 *     amortización (casilla 0117), que sí se conserva y se muestra en Mobiliario.
 *
 * Caso real Tenderina 64 4IZ · IRPF 2024 (el total mostraba 58.026 €).
 */
const INM = 42;
const EJ = 2024;

const gasto = (
  casillaAEAT: string,
  importe: number,
  concepto: string,
  categoria: GastoInmueble['categoria'] = 'otro',
): GastoInmueble =>
  ({
    id: Math.round(importe),
    inmuebleId: INM,
    ejercicio: EJ,
    fecha: `${EJ}-12-31`,
    concepto,
    categoria,
    casillaAEAT,
    importe,
    origen: 'xml_aeat',
    estado: 'declarado',
    createdAt: '',
    updatedAt: '',
  }) as GastoInmueble;

// Gastos declarados: recurrentes reales + amort inmueble + base + mejora dup.
const gastosReales: GastoInmueble[] = [
  gasto('0106', 4750, 'Declaración AEAT 2024', 'reparacion'),
  gasto('0115', 444, 'Declaración AEAT 2024', 'ibi'),
  gasto('0109', 680, 'Declaración AEAT 2024', 'comunidad'),
  gasto('0117', 1930, 'Declaración AEAT 2024', 'otro'), // amort mobiliario (coste real)
  gasto('0131', 306, 'Declaración AEAT 2024 — Amortización inmueble'), // coste real
  gasto('0130', 24070, 'Declaración AEAT 2024 — Base amortización'), // NO es coste
  gasto('0129', 3545, 'Declaración AEAT 2024 — Mejoras ejercicio'), // duplica la mejora
];

const mejoras: MejoraInmueble[] = [
  {
    id: 1,
    inmuebleId: INM,
    ejercicio: EJ,
    descripcion: 'Mejora declarada IRPF 2024',
    tipo: 'mejora',
    importe: 3545,
    fecha: `${EJ}-12-31`,
  } as MejoraInmueble,
];

const mobiliario: MuebleInmueble[] = [
  {
    id: 1,
    inmuebleId: INM,
    ejercicio: EJ,
    descripcion: 'Mobiliario detectado IRPF 2024',
    fechaAlta: `${EJ}-01-01`,
    importe: 19303, // valor del mueble (activo) — NO coste del año
    vidaUtil: 10,
    activo: true,
  } as MuebleInmueble,
];

const totalReal = (lista: GastoInmuebleVisual[], ejercicio: number): number =>
  lista
    .filter((i) => i.origen !== 'recurrente' && (i.ejercicio === undefined || i.ejercicio === ejercicio))
    .reduce((s, i) => s + (i.importeReal ?? 0), 0);

describe('coste real del año · sin bases contables ni duplicados', () => {
  const lista = construirListaVisualGastosInmueble({
    inmuebleId: INM,
    gastosReales,
    mejoras,
    mobiliario,
  }).filter(esCosteRealDelAnioInmueble);

  it('excluye base amortización (0130), mejora duplicada (0129) y el activo mobiliario', () => {
    const casillas = lista.filter((i) => i.origen === 'real').map((i) => i.casillaAEAT);
    expect(casillas).not.toContain('0130');
    expect(casillas).not.toContain('0129');
    // El alta patrimonial del mueble no aparece como coste.
    expect(lista.some((i) => i.origen === 'mobiliario')).toBe(false);
  });

  it('conserva los gastos reales, la amortización del inmueble y la mejora (una sola vez)', () => {
    // 4750 + 444 + 680 + 1930 (amort mobiliario) + 306 (amort inmueble) + 3545 (mejora)
    expect(totalReal(lista, EJ)).toBe(11655);
    // La mejora aparece exactamente una vez (registro de mejora, no la casilla 0129).
    expect(lista.filter((i) => Math.abs((i.importeReal ?? 0) - 3545) < 0.5)).toHaveLength(1);
  });

  it('la amortización del mobiliario (0117) se agrupa en Mobiliario', () => {
    const amortMueble = lista.find((i) => i.casillaAEAT === '0117');
    expect(amortMueble?.grupoVisual).toBe('mobiliario');
  });
});
