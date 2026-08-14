import { modelFromProperty, propertyFromModel, impuestosTotal, emptyMeta } from '../model';
import { prefillPrestamoDesdeInmueble } from '../financiacion';
import { calcularTributosAuto } from '../tributos';
import type { Property } from '../../../../services/db';

const baseProp = (over: Partial<Property> = {}): Property =>
  ({
    tipoActivo: 'piso',
    alias: 'Tenderina 64',
    address: 'CL Tenderina 64',
    postalCode: '33010',
    municipality: 'Oviedo',
    province: 'Asturias',
    ccaa: 'Asturias',
    purchaseDate: '2023-08-25',
    state: 'activo',
    transmissionRegime: 'usada',
    acquisitionCosts: { price: 49000, notary: 0, registry: 0, management: 0, other: [] },
    documents: [],
    ...over,
  }) as unknown as Property;

describe('mappers Property <-> modelo · sin pérdida', () => {
  it('preserva el DESGLOSE de "otros gastos" si el agregado no se toca', () => {
    const prop = baseProp({
      acquisitionCosts: {
        price: 49000,
        notary: 0,
        registry: 0,
        management: 0,
        other: [
          { concept: 'Tasación', amount: 300 },
          { concept: 'Gastos varios', amount: 250 },
        ],
      },
    });
    const { model, meta } = modelFromProperty(prop, '');
    expect(model.otros).toBe(550); // agregado
    // sin editar el agregado → se conserva el desglose original
    const back = propertyFromModel(model, meta);
    expect(back.acquisitionCosts.other).toEqual([
      { concept: 'Tasación', amount: 300 },
      { concept: 'Gastos varios', amount: 250 },
    ]);
  });

  it('si se EDITA el agregado de otros gastos, se guarda como un único concepto', () => {
    const prop = baseProp({
      acquisitionCosts: {
        price: 49000,
        notary: 0,
        registry: 0,
        management: 0,
        other: [{ concept: 'Tasación', amount: 300 }],
      },
    });
    const { model, meta } = modelFromProperty(prop, '');
    const back = propertyFromModel({ ...model, otros: 800 }, meta);
    expect(back.acquisitionCosts.other).toEqual([{ concept: 'Otros', amount: 800 }]);
  });

  it('ITP manual (difiere del auto) se conserva; total = ITP en usada', () => {
    const usada = baseProp({
      transmissionRegime: 'usada',
      acquisitionCosts: { price: 49000, notary: 0, registry: 0, management: 0, other: [], itp: 3200 },
    });
    const { model, meta } = modelFromProperty(usada, '');
    // 3200 ≠ auto (49000×8% Asturias = 3920) → se marca manual y se conserva
    expect(model.itp).toBe(3200);
    expect(model.itpIsManual).toBe(true);
    expect(impuestosTotal(model)).toBe(3200);
    expect(propertyFromModel(model, meta).acquisitionCosts.itp).toBe(3200);
  });

  it('obra nueva · IVA + AJD por separado; total = IVA + AJD', () => {
    const nueva = baseProp({
      tipoActivo: 'piso',
      transmissionRegime: 'obra-nueva',
      acquisitionCosts: { price: 200000, notary: 0, registry: 0, management: 0, other: [], iva: 20000, ajd: 3000 },
    });
    const { model, meta } = modelFromProperty(nueva, '');
    expect(model.iva).toBe(20000);
    expect(model.ajd).toBe(3000);
    expect(impuestosTotal(model)).toBe(23000);
    const back = propertyFromModel(model, meta);
    expect(back.acquisitionCosts.iva).toBe(20000);
    expect(back.acquisitionCosts.ajd).toBe(3000);
    expect(back.acquisitionCosts.itp).toBeUndefined();
  });

  it('conserva la FK del préstamo vinculado y aportación/financiado', () => {
    const prop = baseProp({
      estructuraCompra: { aportacionPropia: 10000, importeFinanciado: 39000, prestamoVinculadoId: 'p-1' },
    });
    const { model, meta } = modelFromProperty(prop, '');
    expect(model.aportacionPropia).toBe(10000);
    expect(model.importeFinanciado).toBe(39000);
    expect(meta.prestamoVinculadoId).toBe('p-1');
    const back = propertyFromModel(model, meta);
    expect(back.estructuraCompra).toEqual({
      aportacionPropia: 10000,
      importeFinanciado: 39000,
      prestamoVinculadoId: 'p-1',
    });
  });

  it('no pierde los documentos que la ficha no gestiona', () => {
    const prop = baseProp({ documents: [7, 8, 9] });
    const { model, meta } = modelFromProperty(prop, '');
    expect(propertyFromModel(model, meta).documents).toEqual([7, 8, 9]);
  });
});

describe('vivienda habitual · check que alterna sin pisar el arrendamiento', () => {
  it('marca vivienda_habitual cuando el check está activo', () => {
    const prop = baseProp({ usoTipo: 'disponible' });
    const { model, meta } = modelFromProperty(prop, '');
    expect(model.esViviendaHabitual).toBe(false);
    const back = propertyFromModel({ ...model, esViviendaHabitual: true }, meta);
    expect(back.usoTipo).toBe('vivienda_habitual');
  });

  it('conserva el uso de arrendamiento original si no es vivienda habitual', () => {
    const prop = baseProp({
      usoTipo: 'larga_estancia',
      alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 3 },
    });
    const { model, meta } = modelFromProperty(prop, '');
    expect(model.esViviendaHabitual).toBe(false);
    const back = propertyFromModel(model, meta);
    // el arrendamiento se conserva verbatim (se gestiona en el detalle)
    expect(back.usoTipo).toBe('larga_estancia');
    expect(back.alquilerPorHabitaciones).toEqual({ activo: true, numeroHabitaciones: 3 });
  });

  it('al desmarcar una vivienda habitual, pasa a disponible', () => {
    const prop = baseProp({ usoTipo: 'vivienda_habitual' });
    const { model, meta } = modelFromProperty(prop, '');
    expect(model.esViviendaHabitual).toBe(true);
    const back = propertyFromModel({ ...model, esViviendaHabitual: false }, meta);
    expect(back.usoTipo).toBe('disponible');
  });

  it('parking/trastero no persisten usoTipo', () => {
    const prop = baseProp({ tipoActivo: 'parking', usoTipo: undefined });
    const { model, meta } = modelFromProperty(prop, '');
    expect(propertyFromModel(model, meta).usoTipo).toBeUndefined();
  });
});

describe('calcularTributosAuto', () => {
  it('ITP sobre valor de referencia con el tipo de la CCAA (Asturias 8%)', () => {
    const t = calcularTributosAuto({ tipoActivo: 'piso', ccaa: 'Asturias', precioCompra: 100000, valorReferencia: 120000 });
    expect(t.itpRate).toBe(8);
    expect(t.itp).toBe(9600); // 120000 × 8%
  });

  it('IVA 10% en vivienda y 21% en el resto; AJD 1.5% sobre el precio', () => {
    const vivienda = calcularTributosAuto({ tipoActivo: 'piso', ccaa: 'Madrid', precioCompra: 200000, valorReferencia: 200000 });
    expect(vivienda.ivaRate).toBe(10);
    expect(vivienda.iva).toBe(20000);
    expect(vivienda.ajd).toBe(3000); // 200000 × 1.5%

    const local = calcularTributosAuto({ tipoActivo: 'local', ccaa: 'Madrid', precioCompra: 200000, valorReferencia: 200000 });
    expect(local.ivaRate).toBe(21);
    expect(local.iva).toBe(42000);
  });
});

describe('emptyMeta', () => {
  it('arranca sin arrendamiento previo', () => {
    const meta = emptyMeta();
    expect(meta.usoTipoOriginal).toBeUndefined();
    expect(meta.alquilerOriginal).toBeUndefined();
  });
});

describe('prefillPrestamoDesdeInmueble', () => {
  it('con inmueble · hipotecario + destino ADQUISICIÓN + garantía · nombre por dirección', () => {
    const pre = prefillPrestamoDesdeInmueble({
      alias: 'Tenderina 64',
      direccion: 'CL Tenderina 64',
      importeFinanciado: 75000,
      fechaCompra: '2023-08-25',
      inmuebleId: 2,
    });
    expect(pre.principalInicial).toBe(75000);
    expect(pre.ambito).toBe('INMUEBLE');
    expect(pre.tipoPrestamoV2).toBe('hipotecario'); // arranca como hipotecario, sin clic extra
    expect(pre.nombre).toBe('Hipoteca CL Tenderina 64'); // dirección, no alias
    expect(pre.destinos?.[0]).toMatchObject({ tipo: 'ADQUISICION', inmuebleId: '2', importe: 75000 });
    expect(pre.garantias?.[0]).toMatchObject({ tipo: 'HIPOTECARIA', inmuebleId: '2' });
  });

  it('sin dirección · cae al alias para el nombre', () => {
    const pre = prefillPrestamoDesdeInmueble({
      alias: 'Tenderina 64',
      importeFinanciado: 75000,
      fechaCompra: '2023-08-25',
      inmuebleId: 2,
    });
    expect(pre.nombre).toBe('Hipoteca Tenderina 64');
  });

  it('sin inmueble (alta sin guardar) · solo importe, sin destino/garantía/tipo', () => {
    const pre = prefillPrestamoDesdeInmueble({
      alias: 'Nuevo',
      importeFinanciado: 50000,
      fechaCompra: '',
      inmuebleId: undefined,
    });
    expect(pre.principalInicial).toBe(50000);
    expect(pre.ambito).toBe('PERSONAL');
    expect(pre.tipoPrestamoV2).toBeUndefined();
    expect(pre.destinos).toBeUndefined();
    expect(pre.garantias).toBeUndefined();
  });
});
