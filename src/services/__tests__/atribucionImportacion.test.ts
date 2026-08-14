/**
 * Régimen de atribución de rentas (Comunidad de Bienes) · cableado del import al
 * store canónico `entidadesAtribucion`, que el cálculo IRPF ya consume (suma a la
 * base + aplica la retención). Antes el import no lo alimentaba → store vacío.
 *
 * Caso real 2025: entidad E25904640 al 10%, rendimiento capital inmobiliario
 * 1.682,80 €, retención 136,05 €.
 */
import { initDB } from '../db';
import { parseIrpfXml } from '../irpfXmlParserService';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { getEntidades, getRendimientosAtribuidosEjercicio } from '../entidadAtribucionService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';

const XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Declaracion modelo="100" ejercicio="2025">
  <DatosIdentificativos><Declarante><DPNIF_D>53069494F</DPNIF_D><DP_APENOM_D>DEMO</DP_APENOM_D></Declarante></DatosIdentificativos>
  <DatosEconomicos>
    <TomaDatosAmpliada>
      <RegimenesEspeciales>
        <REAtRentas>
          <ENTIDADAR>
            <AR_NifContribuyente><F1NIFNACDLG>E25904640</F1NIFNACDLG><F1PCTDLG>10.00</F1PCTDLG></AR_NifContribuyente>
            <AR_RendCapiInmobiliario><IMP1>1682.80</IMP1><VRET5B>136.05</VRET5B></AR_RendCapiInmobiliario>
            <F1NIFAR>E25904640</F1NIFAR><F1PCT>10.00</F1PCT><F1EE>1682.80</F1EE><F1EG>1682.80</F1EG><F1EP>136.05</F1EP>
          </ENTIDADAR>
        </REAtRentas>
      </RegimenesEspeciales>
    </TomaDatosAmpliada>
    <Resultados><RESULTADO>0</RESULTADO><RegimenesEspecialesRes><REAtRentasRes><F1CIM>1682.80</F1CIM></REAtRentasRes></RegimenesEspecialesRes></Resultados>
  </DatosEconomicos>
</Declaracion>`;

async function limpiar() {
  const db = await initDB();
  await Promise.all([db.clear('entidadesAtribucion'), db.clear('ejerciciosFiscalesCoord'), db.clear('properties')]);
}

describe('atribución de rentas · el import alimenta entidadesAtribucion', () => {
  beforeEach(limpiar);

  it('el parser lee REAtRentas/ENTIDADAR', () => {
    const decl = parseIrpfXml(XML);
    expect(decl.entidadesAtribucion).toHaveLength(1);
    const e = decl.entidadesAtribucion![0];
    expect(e.nif).toBe('E25904640');
    expect(e.tipoEntidad).toBe('CB');
    expect(e.porcentajeParticipacion).toBeCloseTo(10, 2);
    expect(e.tipoRenta).toBe('capital_inmobiliario');
    expect(e.rendimientoAtribuido).toBeCloseTo(1682.80, 2);
    expect(e.retencionAtribuida).toBeCloseTo(136.05, 2);
  });

  it('importar crea la entidad y el cálculo la ve (rendimiento + retención)', async () => {
    await distribuirDeclaracion(parseIrpfXml(XML), OPCIONES_DEFAULT);
    const entidades = await getEntidades();
    expect(entidades).toHaveLength(1);
    expect(entidades[0].nif).toBe('E25904640');

    const atrib = await getRendimientosAtribuidosEjercicio(2025);
    expect(atrib.capitalInmobiliario.total).toBeCloseTo(1682.80, 2);
    expect(atrib.capitalInmobiliario.retenciones).toBeCloseTo(136.05, 2);
  });

  it('idempotencia: reimportar no duplica la entidad ni el ejercicio', async () => {
    await distribuirDeclaracion(parseIrpfXml(XML), OPCIONES_DEFAULT);
    await distribuirDeclaracion(parseIrpfXml(XML), OPCIONES_DEFAULT);
    const entidades = await getEntidades();
    expect(entidades).toHaveLength(1);
    expect(entidades[0].ejercicios).toHaveLength(1);
    const atrib = await getRendimientosAtribuidosEjercicio(2025);
    expect(atrib.capitalInmobiliario.total).toBeCloseTo(1682.80, 2);
  });

  it('NO se crea como inmueble en propiedad', async () => {
    await distribuirDeclaracion(parseIrpfXml(XML), OPCIONES_DEFAULT);
    const props = await (await initDB()).getAll('properties');
    expect(props).toHaveLength(0);
  });
});
