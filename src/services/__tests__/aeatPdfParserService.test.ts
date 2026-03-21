import {
  crearImportacionManualVacia,
  extraerCasillasDesdeTextoModelo100,
  mapearCasillasAImportacion,
} from '../aeatPdfParserService';

describe('aeatPdfParserService', () => {
  it('extrae casillas del texto del Modelo 100 y conserva la última ocurrencia', () => {
    const texto = `
      Base imponible general 150.924,07 0435
      Base imponible del ahorro 1.220,55 0460
      Resultado -5.509,89 0670
      Resultado corregido -4.000,00 0670
    `;

    const casillas = extraerCasillasDesdeTextoModelo100(texto);

    expect(casillas).toEqual(expect.arrayContaining([
      expect.objectContaining({ numero: '0435', valor: 150924.07 }),
      expect.objectContaining({ numero: '0460', valor: 1220.55 }),
      expect.objectContaining({ numero: '0670', valor: -4000 }),
    ]));
  });

  it('mapea las casillas extraídas a la estructura de importación manual', () => {
    const data = mapearCasillasAImportacion([
      { numero: '0435', valor: 150924.07, confianza: 'alta', lineaOriginal: 'x' },
      { numero: '0460', valor: 1220.55, confianza: 'alta', lineaOriginal: 'x' },
      { numero: '0505', valor: 147665.23, confianza: 'alta', lineaOriginal: 'x' },
      { numero: '0596', valor: 15000, confianza: 'alta', lineaOriginal: 'x' },
      { numero: '0609', valor: 15136.05, confianza: 'alta', lineaOriginal: 'x' },
      { numero: '0670', valor: -5509.89, confianza: 'alta', lineaOriginal: 'x' },
    ], 2024);

    expect(data).toMatchObject({
      ejercicio: 2024,
      baseImponibleGeneral: 150924.07,
      baseImponibleAhorro: 1220.55,
      baseLiquidableGeneral: 147665.23,
      retencionTrabajo: 15000,
      totalRetenciones: 15136.05,
      resultado: -5509.89,
    });
  });

  it('crea una estructura vacía utilizable para el wizard', () => {
    expect(crearImportacionManualVacia(2023)).toMatchObject({
      ejercicio: 2023,
      baseImponibleGeneral: 0,
      totalRetenciones: 0,
      resultado: 0,
      arrastres: [],
    });
  });
});
