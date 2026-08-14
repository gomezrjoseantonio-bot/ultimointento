import { modelFromProperty, propertyFromModel } from '../model';
import { prefillPrestamoDesdeInmueble } from '../financiacion';
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
    const { model, meta } = modelFromProperty(prop, [], [], '');
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
    const { model, meta } = modelFromProperty(prop, [], [], '');
    const back = propertyFromModel({ ...model, otros: 800 }, meta);
    expect(back.acquisitionCosts.other).toEqual([{ concept: 'Otros', amount: 800 }]);
  });

  it('conserva ITP e IVA por separado según el estado', () => {
    const usada = baseProp({
      transmissionRegime: 'usada',
      acquisitionCosts: { price: 49000, notary: 0, registry: 0, management: 0, other: [], itp: 3200 },
    });
    const { model, meta } = modelFromProperty(usada, [], [], '');
    expect(model.impuestos).toBe(3200);
    expect(propertyFromModel(model, meta).acquisitionCosts.itp).toBe(3200);

    const nueva = baseProp({
      transmissionRegime: 'obra-nueva',
      acquisitionCosts: { price: 200000, notary: 0, registry: 0, management: 0, other: [], iva: 20000 },
    });
    const r2 = modelFromProperty(nueva, [], [], '');
    expect(r2.model.impuestos).toBe(20000);
    expect(propertyFromModel(r2.model, r2.meta).acquisitionCosts.iva).toBe(20000);
  });

  it('conserva la FK del préstamo vinculado y aportación/financiado', () => {
    const prop = baseProp({
      estructuraCompra: { aportacionPropia: 10000, importeFinanciado: 39000, prestamoVinculadoId: 'p-1' },
    });
    const { model, meta } = modelFromProperty(prop, [], [], '');
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
    const { model, meta } = modelFromProperty(prop, [], [], '');
    expect(propertyFromModel(model, meta).documents).toEqual([7, 8, 9]);
  });
});

describe('prefillPrestamoDesdeInmueble', () => {
  it('con inmueble · destino ADQUISICIÓN + garantía hipotecaria + importe', () => {
    const pre = prefillPrestamoDesdeInmueble({
      alias: 'Tenderina 64',
      importeFinanciado: 75000,
      fechaCompra: '2023-08-25',
      inmuebleId: 2,
    });
    expect(pre.principalInicial).toBe(75000);
    expect(pre.ambito).toBe('INMUEBLE');
    expect(pre.destinos?.[0]).toMatchObject({ tipo: 'ADQUISICION', inmuebleId: '2', importe: 75000 });
    expect(pre.garantias?.[0]).toMatchObject({ tipo: 'HIPOTECARIA', inmuebleId: '2' });
  });

  it('sin inmueble (alta sin guardar) · solo importe, sin destino/garantía', () => {
    const pre = prefillPrestamoDesdeInmueble({
      alias: 'Nuevo',
      importeFinanciado: 50000,
      fechaCompra: '',
      inmuebleId: undefined,
    });
    expect(pre.principalInicial).toBe(50000);
    expect(pre.ambito).toBe('PERSONAL');
    expect(pre.destinos).toBeUndefined();
    expect(pre.garantias).toBeUndefined();
  });
});
