import { parseIrpfXml } from '../irpfXmlParserService';

/**
 * Una declaración importada por XML con transmisión de inmueble debe emitir en
 * `casillas` las casillas REALES de la AEAT de la ganancia patrimonial, para
 * que la Sección E del Modelo 100 no salga vacía (mismas casillas que un PDF).
 *
 * Caso real 2025 · venta de Tenderina 48 (0454010TP7005S0012TS):
 *   G2DINME 176.928,44 · G2DINMF 145.358,22 · ganancia 31.570,22
 *   HSALDO44 1.344,99 · HSALDO44B 27.764,23
 */
const XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2025">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <GPOtrosInmuebles>
        <ElementoInmueble>
          <G2INMRC1>0454010TP7005S0012TS</G2INMRC1>
          <G2DINME>176928.44</G2DINME>
          <G2DINMF>145358.22</G2DINMF>
          <G2DINMI>31570.22</G2DINMI>
        </ElementoInmueble>
      </GPOtrosInmuebles>
    </TomaDatosAmpliada>
    <Resultados>
      <GPOtrosInmueblesRes><G2INMT4>31570.22</G2INMT4></GPOtrosInmueblesRes>
      <IntegracionRes><GPPatrimonialesRes><SUMAGA>31570.22</SUMAGA><GPAHOG>31570.22</GPAHOG></GPPatrimonialesRes></IntegracionRes>
      <BaseImponibleRes><GPAHOH>31570.22</GPAHOH><HSALDO44>1344.99</HSALDO44><HSALDO44B>27764.23</HSALDO44B><BIAHOH>3222.65</BIAHOH></BaseImponibleRes>
      <RESULTADO>287.05</RESULTADO>
    </Resultados>
  </DatosEconomicos>
</Declaracion>`;

describe('parseIrpfXml · ganancia por transmisión de inmueble → casillas reales', () => {
  it('emite 1826/1830/0424/1845 y 0440/0441 en casillas', () => {
    const decl = parseIrpfXml(XML);
    expect(decl.casillas['1826']).toBeCloseTo(176928.44, 2);
    expect(decl.casillas['1830']).toBeCloseTo(145358.22, 2);
    expect(decl.casillas['0424']).toBeCloseTo(31570.22, 2);
    expect(decl.casillas['1845']).toBeCloseTo(31570.22, 2);
    expect(decl.casillas['0440']).toBeCloseTo(1344.99, 2);
    expect(decl.casillas['0441']).toBeCloseTo(27764.23, 2);
  });

  it('una declaración sin transmisiones no añade esas casillas', () => {
    const sinVenta = XML.replace(/<GPOtrosInmuebles>[\s\S]*?<\/GPOtrosInmuebles>/, '')
      .replace(/<GPOtrosInmueblesRes>[\s\S]*?<\/GPOtrosInmueblesRes>/, '')
      .replace(/<IntegracionRes>[\s\S]*?<\/IntegracionRes>/, '')
      .replace(/<HSALDO44>[\s\S]*?<\/HSALDO44B>/, '')
      .replace(/<GPAHOH>31570.22<\/GPAHOH>/, '');
    const decl = parseIrpfXml(sinVenta);
    expect(decl.casillas['0424']).toBeUndefined();
    expect(decl.casillas['1826']).toBeUndefined();
  });
});
