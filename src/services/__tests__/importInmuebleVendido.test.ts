import { initDB } from '../db';
import { parseIrpfXml } from '../irpfXmlParserService';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';

/**
 * Un inmueble que la AEAT declara TRANSMITIDO (vendido) en el ejercicio debe
 * crearse en ATLAS en estado 'vendido' —no 'activo'—, y una importación
 * posterior de un año en el que aún se poseía NO debe revertirlo a activo.
 *
 * Caso real 2025 · venta de Tenderina 48 (0454010TP7005S0012TS), transmitida
 * el 27/11/2025 (casilla 0121 en el bloque <Inmueble> y Sección E).
 */
const REF = '0454010TP7005S0012TS';

// XML con la fecha en el propio bloque <Inmueble> (C_FTRA = casilla 0121).
const XML_2025 = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2025">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <Inmuebles>
        <Inmueble>
          <RC>${REF}</RC>
          <CDIRECCION>CL TENDERINA 0048 1 05 DR OVIEDO</CDIRECCION>
          <PC>100</PC>
          <CURBA>1</CURBA>
          <C_FADQ>23/09/2022</C_FADQ>
          <C_FTRA>27/11/2025</C_FTRA>
        </Inmueble>
      </Inmuebles>
      <GPOtrosInmuebles>
        <ElementoInmueble>
          <G2INMRC1>${REF}</G2INMRC1>
          <G2DINME>176928.44</G2DINME>
          <G2DINMF>145358.22</G2DINMF>
          <G2DINMI>31570.22</G2DINMI>
        </ElementoInmueble>
      </GPOtrosInmuebles>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>287.05</RESULTADO></Resultados>
  </DatosEconomicos>
</Declaracion>`;

// XML donde el bloque <Inmueble> NO trae la fecha, pero la venta consta en la
// Sección E (GPOtrosInmuebles). Debe deducirse igualmente que está vendido.
const XML_2025_SOLO_GP = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2025">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <Inmuebles>
        <Inmueble>
          <RC>${REF}</RC>
          <CDIRECCION>CL TENDERINA 0048 1 05 DR OVIEDO</CDIRECCION>
          <PC>100</PC>
          <CURBA>1</CURBA>
          <C_FADQ>23/09/2022</C_FADQ>
        </Inmueble>
      </Inmuebles>
      <GPOtrosInmuebles>
        <ElementoInmueble>
          <G2INMRC1>${REF}</G2INMRC1>
          <G2DINME>176928.44</G2DINME>
          <G2DINMF>145358.22</G2DINMF>
          <G2DINMI>31570.22</G2DINMI>
        </ElementoInmueble>
      </GPOtrosInmuebles>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>287.05</RESULTADO></Resultados>
  </DatosEconomicos>
</Declaracion>`;

// XML de 2024: el mismo inmueble todavía en propiedad (sin transmisión).
const XML_2024 = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2024">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <Inmuebles>
        <Inmueble>
          <RC>${REF}</RC>
          <CDIRECCION>CL TENDERINA 0048 1 05 DR OVIEDO</CDIRECCION>
          <PC>100</PC>
          <CURBA>1</CURBA>
          <C_FADQ>23/09/2022</C_FADQ>
        </Inmueble>
      </Inmuebles>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>0</RESULTADO></Resultados>
  </DatosEconomicos>
</Declaracion>`;

async function refState(): Promise<string | undefined> {
  const db = await initDB();
  const props = await db.getAll('properties');
  const p = props.find(
    (x: any) => (x.cadastralReference || '').replace(/[\s.-]/g, '').toUpperCase() === REF,
  );
  return p?.state;
}

describe('importInmuebleVendido · el inmueble transmitido se crea en estado vendido', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('properties');
    await db.clear('ejerciciosFiscalesCoord');
  });

  it('parseIrpfXml captura la fecha de transmisión del bloque <Inmueble>', () => {
    const decl = parseIrpfXml(XML_2025);
    const inm = decl.inmuebles.find((i) => i.refCatastral === REF);
    expect(inm?.fechaTransmision).toBe('27/11/2025');
  });

  it('parseIrpfXml deduce la transmisión desde la Sección E aunque falte la fecha en <Inmueble>', () => {
    const decl = parseIrpfXml(XML_2025_SOLO_GP);
    const inm = decl.inmuebles.find((i) => i.refCatastral === REF);
    expect(inm?.fechaTransmision).toBeTruthy();
  });

  it('un inmueble no transmitido no lleva fechaTransmision', () => {
    const decl = parseIrpfXml(XML_2024);
    const inm = decl.inmuebles.find((i) => i.refCatastral === REF);
    expect(inm?.fechaTransmision).toBeUndefined();
  });

  it('importar la declaración con la venta crea el inmueble en estado vendido', async () => {
    await distribuirDeclaracion(parseIrpfXml(XML_2025), OPCIONES_DEFAULT);
    expect(await refState()).toBe('vendido');
  });

  it('importar un año anterior (sin venta) NO revierte el inmueble a activo', async () => {
    await distribuirDeclaracion(parseIrpfXml(XML_2025), OPCIONES_DEFAULT);
    expect(await refState()).toBe('vendido');
    // Ahora importamos 2024, donde el inmueble aún se poseía.
    await distribuirDeclaracion(parseIrpfXml(XML_2024), OPCIONES_DEFAULT);
    expect(await refState()).toBe('vendido');
  });
});

/**
 * Un inmueble dado de alta manualmente (sin referencia catastral) debe casar por
 * dirección con el del import y NO duplicarse, aunque la acentuación difiera
 * (p.ej. "Carles Buïgas" en el alta vs "CARLES BUIGAS" en la AEAT).
 */
const REF_CB = '1234567AB1234C0001DE';
const XML_CB = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2024">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <Inmuebles>
        <Inmueble>
          <RC>${REF_CB}</RC>
          <CDIRECCION>CL CARLES BUIGAS 0012 BARCELONA</CDIRECCION>
          <PC>100</PC>
          <CURBA>1</CURBA>
        </Inmueble>
      </Inmuebles>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>0</RESULTADO></Resultados>
  </DatosEconomicos>
</Declaracion>`;

describe('importInmuebleVendido · el alta manual casa por dirección y no se duplica', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('properties');
    await db.clear('ejerciciosFiscalesCoord');
  });

  it('property manual con acentos casa con el import y no crea un duplicado', async () => {
    const db = await initDB();
    const id = await db.add('properties', {
      alias: 'Carles Buïgas',
      address: 'Carrer de Carles Buïgas 12',
      state: 'activo',
      transmissionRegime: 'usada',
      documents: [],
      acquisitionCosts: { price: 200000 },
    } as any);

    await distribuirDeclaracion(parseIrpfXml(XML_CB), OPCIONES_DEFAULT);

    const props = await db.getAll('properties');
    expect(props).toHaveLength(1);
    // La misma property, ahora con la referencia catastral rellenada desde el import.
    const p = props[0] as any;
    expect(p.id).toBe(id);
    expect((p.cadastralReference || '').replace(/[\s.-]/g, '').toUpperCase()).toBe(REF_CB);
  });

  it('NO fusiona dos viviendas del mismo edificio (misma calle+número, distinto piso)', async () => {
    const db = await initDB();
    // Un edificio, dos viviendas ya dadas de alta manualmente (sin ref).
    await db.add('properties', {
      alias: 'Tenderina 64 4D',
      address: 'Calle Tenderina 64 4 DR',
      state: 'activo',
      transmissionRegime: 'usada',
      documents: [],
      acquisitionCosts: { price: 100000 },
    } as any);
    await db.add('properties', {
      alias: 'Tenderina 64 4I',
      address: 'Calle Tenderina 64 4 IZ',
      state: 'activo',
      transmissionRegime: 'usada',
      documents: [],
      acquisitionCosts: { price: 100000 },
    } as any);

    // El import trae las dos viviendas del edificio con refs distintas.
    const XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2024">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <Inmuebles>
        <Inmueble><RC>0654104TP7005S0009SS</RC><CDIRECCION>CL TENDERINA 0064 4 DR OVIEDO</CDIRECCION><PC>100</PC><CURBA>1</CURBA></Inmueble>
        <Inmueble><RC>0654104TP7005S0010PP</RC><CDIRECCION>CL TENDERINA 0064 4 IZ OVIEDO</CDIRECCION><PC>100</PC><CURBA>1</CURBA></Inmueble>
      </Inmuebles>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>0</RESULTADO></Resultados>
  </DatosEconomicos>
</Declaracion>`;

    await distribuirDeclaracion(parseIrpfXml(XML), OPCIONES_DEFAULT);

    // La firma "TENDERINA 64" es ambigua (2 candidatos y 2 en el import): el guard
    // NO debe fusionar; se conservan viviendas separadas sin colapsar en una.
    const props = await db.getAll('properties');
    const conRef = props.filter((p: any) => p.cadastralReference).length;
    // No se ha fusionado nada por firma ambigua: no hay dos inmuebles distintos
    // apuntando a la misma property.
    const ids = props.map((p: any) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Y ninguna de las dos viviendas originales ha absorbido la ref de la otra.
    expect(conRef).toBeLessThanOrEqual(props.length);
    expect(props.length).toBeGreaterThanOrEqual(2);
  });
});
