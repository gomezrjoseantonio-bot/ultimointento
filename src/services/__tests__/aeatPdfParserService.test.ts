import {
  crearImportacionManualVacia,
  extraerCasillasDesdeTextoModelo100,
  mapearCasillasAImportacion,
  reconstruirLineasPDF,
} from '../aeatPdfParserService';

describe('aeatPdfParserService', () => {
  it('reconstruye líneas del PDF usando coordenadas Y y preserva la casilla al final', () => {
    const lineas = reconstruirLineasPDF([
      { str: '0435', transform: [1, 0, 0, 1, 480, 720] },
      { str: '148.505,78', transform: [1, 0, 0, 1, 420, 720] },
      { str: 'general', transform: [1, 0, 0, 1, 250, 720] },
      { str: 'Base', transform: [1, 0, 0, 1, 120, 720] },
      { str: '0460', transform: [1, 0, 0, 1, 460, 680] },
      { str: '357,63', transform: [1, 0, 0, 1, 410, 680] },
      { str: 'ahorro', transform: [1, 0, 0, 1, 200, 680] },
      { str: 'del', transform: [1, 0, 0, 1, 170, 680] },
      { str: 'Base', transform: [1, 0, 0, 1, 120, 680] },
    ]);

    expect(lineas).toEqual([
      'Base general 148.505,78 0435',
      'Base del ahorro 357,63 0460',
    ]);

    expect(extraerCasillasDesdeTextoModelo100(lineas.join('\n'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ numero: '0435', valor: 148505.78 }),
      expect.objectContaining({ numero: '0460', valor: 357.63 }),
    ]));
  });

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
