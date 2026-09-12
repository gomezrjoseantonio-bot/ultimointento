// E2.4.1 · el catálogo único · 4 ejes independientes · sin fiscalidad dentro.

import {
  AMBITOS,
  FAMILIAS,
  METODOS_PAGO,
  NATURALEZAS,
  esClasificacionValida,
  esMovimientoInterno,
  familiaPorId,
  familiasDe,
  familiasSugeridas,
  labelClasificacion,
  labelMetodo,
  motivosInvalidos,
  naturalezaPorSigno,
  reclasificar,
  subtiposDe,
  type Clasificacion,
} from '../catalogoUnico';

describe('catalogoUnico · el árbol', () => {
  it('tiene exactamente las familias del DEFINITIVO · 8 ingreso · 22 gasto · 4 interno', () => {
    expect(familiasDe('ingreso').map((f) => f.id)).toEqual([
      'nomina', 'pension', 'autonomo', 'alquiler', 'rendimiento', 'venta', 'inversion', 'otros_ingresos',
    ]);
    expect(familiasDe('gasto').map((f) => f.id)).toEqual([
      'comunidad', 'suministro', 'seguros_alarmas', 'impuestos_tasas', 'reparacion_mantenimiento',
      'reforma_mejora', 'alquiler_renting', 'gestion', 'limpieza', 'mobiliario_enseres',
      'prestamo_hipoteca', 'supermercado', 'ocio', 'transporte', 'cuidado_personal',
      'suscripciones', 'educacion_formacion', 'comisiones_bancarias', 'multas', 'compra_online', 'cuota_reta', 'otros',
    ]);
    expect(familiasDe('movimiento_interno').map((f) => f.id)).toEqual([
      'traspaso', 'aportacion', 'disposicion_prestamo', 'fianza',
    ]);
    expect(FAMILIAS).toHaveLength(34);
  });

  it('los ids son únicos y ninguna familia repite subtipo', () => {
    const ids = FAMILIAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FAMILIAS) {
      const subs = f.subtipos.map((s) => s.id);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });

  it('el subtipo es opcional · hay familias sin segundo nivel y eso es válido', () => {
    expect(subtiposDe('reforma_mejora')).toEqual([]);
    expect(subtiposDe('prestamo_hipoteca')).toEqual([]);
    expect(subtiposDe('suministro').map((s) => s.id)).toEqual(['luz', 'agua', 'gas', 'internet', 'telefonia', 'otros']);
  });

  it('NO lleva fiscalidad · ninguna familia tiene casilla ni deducibilidad', () => {
    for (const f of FAMILIAS) {
      expect(Object.keys(f)).not.toEqual(expect.arrayContaining(['casillaAEAT', 'casilla', 'deducible']));
    }
  });

  it('los 4 ejes tienen sus valores cerrados', () => {
    expect(NATURALEZAS).toEqual(['ingreso', 'gasto', 'movimiento_interno']);
    expect(METODOS_PAGO).toEqual([
      'transferencia', 'bizum', 'domiciliacion', 'tarjeta', 'efectivo', 'cheque', 'cargo_abono_banco',
    ]);
    expect(AMBITOS).toEqual(['personal', 'inmueble']);
    expect(labelMetodo('domiciliacion')).toBe('Domiciliación');
  });
});

describe('catalogoUnico · etiquetar y re-etiquetar', () => {
  const luzDelPiso: Clasificacion = {
    naturaleza: 'gasto',
    familia: 'suministro',
    subtipo: 'luz',
    metodoPago: 'domiciliacion',
    ambito: 'inmueble',
    inmuebleId: 7,
  };

  it('acepta una clasificación coherente en los 4 ejes', () => {
    expect(motivosInvalidos(luzDelPiso)).toEqual([]);
    expect(esClasificacionValida(luzDelPiso)).toBe(true);
    expect(labelClasificacion('suministro', 'luz')).toBe('Suministro · Luz');
    expect(labelClasificacion('reforma_mejora')).toBe('Reforma y mejora');
  });

  it('acepta un movimiento SIN familia (sin clasificar) · la naturaleza y el ámbito bastan', () => {
    expect(esClasificacionValida({ naturaleza: 'gasto', ambito: 'personal' })).toBe(true);
  });

  it('rechaza familia de otra naturaleza, subtipo ajeno y ámbito inmueble sin inmueble', () => {
    expect(motivosInvalidos({ naturaleza: 'ingreso', familia: 'suministro', ambito: 'personal' }))
      .toEqual(['familia_de_otra_naturaleza']);
    expect(motivosInvalidos({ ...luzDelPiso, subtipo: 'gasolina' })).toEqual(['subtipo_desconocido']);
    expect(motivosInvalidos({ ...luzDelPiso, inmuebleId: undefined })).toEqual(['ambito_inmueble_sin_inmueble']);
    expect(motivosInvalidos({ naturaleza: 'gasto', ambito: 'personal', inmuebleId: 3 }))
      .toEqual(['inmueble_sin_ambito_inmueble']);
    expect(motivosInvalidos({ naturaleza: 'gasto', subtipo: 'luz', ambito: 'personal' })).toEqual(['subtipo_sin_familia']);
  });

  it('el ámbito NO agrupa familias · una familia «personal» clasifica un gasto de inmueble si el usuario lo dice', () => {
    // `ambitosAplicables` es un sugerido para el selector, no una validación.
    expect(esClasificacionValida({ naturaleza: 'gasto', familia: 'supermercado', ambito: 'inmueble', inmuebleId: 1 })).toBe(true);
    expect(familiasSugeridas('gasto', 'inmueble').map((f) => f.id)).not.toContain('supermercado');
    expect(familiasSugeridas('gasto', 'inmueble').map((f) => f.id)).toContain('comunidad');
    expect(familiasSugeridas('ingreso', 'personal').map((f) => f.id)).not.toContain('alquiler');
  });

  it('re-etiquetar cambia familia/subtipo · y la naturaleza sigue a la familia', () => {
    const gestion = reclasificar(luzDelPiso, { familia: 'gestion', subtipo: 'gestoria' });
    expect(gestion).toMatchObject({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria', ambito: 'inmueble', inmuebleId: 7 });
    expect(esClasificacionValida(gestion)).toBe(true);

    // Cambiar solo la familia limpia el subtipo viejo: «luz» no es de «comunidad».
    const comunidad = reclasificar(luzDelPiso, { familia: 'comunidad' });
    expect(comunidad.subtipo).toBeUndefined();

    // Un gasto que resulta ser un traspaso · la naturaleza pasa a interno sola.
    const traspaso = reclasificar(luzDelPiso, { familia: 'traspaso', subtipo: 'a_efectivo' });
    expect(traspaso.naturaleza).toBe('movimiento_interno');
    expect(esMovimientoInterno(traspaso)).toBe(true);
    expect(esMovimientoInterno(luzDelPiso)).toBe(false);

    // No muta el original.
    expect(luzDelPiso.familia).toBe('suministro');
  });

  it('el signo decide la naturaleza por defecto · nunca «interno»', () => {
    expect(naturalezaPorSigno(-12)).toBe('gasto');
    expect(naturalezaPorSigno(0)).toBe('ingreso');
    expect(naturalezaPorSigno(950)).toBe('ingreso');
    expect(familiaPorId('no_existe')).toBeUndefined();
  });
});
