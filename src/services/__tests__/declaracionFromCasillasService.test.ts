import {
  extraerDatosActivos,
  parsearInmueblesDesdeTexto,
  reconstruirDeclaracionDesdeCasillas,
} from '../declaracionFromCasillasService';
import type { CasillaExtraida } from '../aeatPdfParserService';

const casillas: CasillaExtraida[] = [
  { numero: '0435', valor: 148505, confianza: 'alta', lineaOriginal: '148.505,00 0435' },
  { numero: '0460', valor: 357, confianza: 'alta', lineaOriginal: '357,00 0460' },
  { numero: '0505', valor: 148505, confianza: 'alta', lineaOriginal: '148.505,00 0505' },
  { numero: '0545', valor: 26420.5, confianza: 'alta', lineaOriginal: '26.420,50 0545' },
  { numero: '0546', valor: 26420.5, confianza: 'alta', lineaOriginal: '26.420,50 0546' },
  { numero: '0570', valor: 26420.5, confianza: 'alta', lineaOriginal: '26.420,50 0570' },
  { numero: '0571', valor: 26420.5, confianza: 'alta', lineaOriginal: '26.420,50 0571' },
  { numero: '0596', valor: 40759, confianza: 'alta', lineaOriginal: '40.759,00 0596' },
  { numero: '0609', valor: 50982, confianza: 'alta', lineaOriginal: '50.982,00 0609' },
  { numero: '0670', valor: 1859, confianza: 'alta', lineaOriginal: '1.859,00 0670' },
  { numero: '1266', valor: 1344, confianza: 'alta', lineaOriginal: '1.344,00 1266' },
  { numero: '1269', valor: 27764, confianza: 'alta', lineaOriginal: '27.764,00 1269' },
];

const pdfText = `
Inmueble 1
Referencia catastral 1234567AB1234C0001DE
Dirección del inmueble Calle Mayor 1 0069
0101 365,00
0102 12000,00
0104 500,00
0105 1000,00
0106 250,00
0107 1250,00
0108 28239,00
0109 300,00
0112 200,00
0113 150,00
0114 100,00
0115 75,00
0117 200,00
0123 100000,00
0124 80000,00
0125 80,00
0126 150000,00
0127 12000,00
0129 0,00
0130 92000,00
0131 2760,00
0146 0,00
0149 6965,00
0150 4179,00
0154 2786,00
`;

describe('declaracionFromCasillasService', () => {
  test('parsea inmuebles del texto del PDF', () => {
    const inmuebles = parsearInmueblesDesdeTexto(pdfText);

    expect(inmuebles).toHaveLength(1);
    expect(inmuebles[0]?.refCatastral).toBe('1234567AB1234C0001DE');
    expect(inmuebles[0]?.box0108).toBe(28239);
  });

  test('reconstruye una declaración completa desde casillas e inmuebles', () => {
    const inmuebles = parsearInmueblesDesdeTexto(pdfText);
    const declaracion = reconstruirDeclaracionDesdeCasillas(2024, casillas, inmuebles);

    expect(declaracion.ejercicio).toBe(2024);
    expect(declaracion.resultado).toBe(1859);
    expect(declaracion.liquidacion.cuotaLiquida).toBe(52841);
    expect(declaracion.baseGeneral.rendimientosInmuebles).toHaveLength(1);
    expect(declaracion.baseGeneral.rendimientosInmuebles[0]?.excesoArrastrable).toBe(28239);
  });

  test('extrae arrastres, pérdidas e información activa', () => {
    const inmuebles = parsearInmueblesDesdeTexto(pdfText);
    const activos = extraerDatosActivos(2024, inmuebles, casillas);

    expect(activos.arrastresGastos).toEqual([
      expect.objectContaining({ inmuebleRefCatastral: '1234567AB1234C0001DE', importeArrastrable: 28239, ejercicioOrigen: 2024 }),
    ]);
    expect(activos.perdidasPendientes).toEqual([
      { ejercicioOrigen: 2022, importePendiente: 1344, tipo: 'ahorro' },
      { ejercicioOrigen: 2023, importePendiente: 27764, tipo: 'ahorro' },
    ]);
    expect(activos.inmueblesDatos[0]?.valorCatastral).toBe(100000);
  });
});
