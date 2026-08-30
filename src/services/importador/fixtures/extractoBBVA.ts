// Filas LITERALES del informe «Últimos movimientos» de BBVA (30/08/2026).
//
// No son un ejemplo inventado: son las que destaparon los tres fallos del
// importador, y viven en el repo para que CI los pueda reproducir sin que nadie
// tenga que subir un fichero a mano.
//
// Se conservan rarezas del fichero real que importan al detector de columnas:
//   · una primera columna VACÍA antes de `F.Valor`;
//   · dos cabeceras llamadas igual (`Divisa`);
//   · el identificador repetido en `Movimiento` y en `Observaciones`.

/** La fila de cabeceras, tal cual la trae el informe. */
export const CABECERAS_BBVA: readonly string[] = [
  '', 'F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe',
  'Divisa', 'Disponible', 'Divisa', 'Observaciones',
];

/**
 * Las filas que interesan, con su valor NUMÉRICO tal como está en el xlsx.
 * SheetJS las entrega como texto (`raw: false`), que es de donde salía el ×10.
 */
export const FILAS_BBVA: ReadonlyArray<readonly unknown[]> = [
  // Un decimal · la cuota del préstamo personal. Entraba como -2854.
  ['', '31/01/2026', '02/02/2026', 'Cargo por amortizacion de prestamo/credito',
    '0182-5322-27-0830842450', -285.4, 'EUR', 1408.99, 'EUR', '0182-5322-27-0830842450'],
  // Dos decimales · acertaba, y por eso el fallo pasó desapercibido.
  ['', '05/02/2026', '05/02/2026', 'Adeudo mensual de tarjeta',
    'Adeudo nº 2026036000123456', -25.17, 'EUR', 1383.82, 'EUR', 'N 2026036000123456 Tarjeta'],
  // Sin decimales.
  ['', '30/01/2026', '30/01/2026', 'Retirada de efectivo sin soporte',
    'Efectivo móvil', -190, 'EUR', 1694.39, 'EUR', 'TELF: *****2972 - DISPENSA SIN SOPORTE'],
  // El prestamista vive en Observaciones · en Movimiento solo hay nº de recibo.
  ['', '06/05/2026', '06/05/2026', 'Adeudo bankinter consumer finance',
    'Adeudo nº 2026126000711287', -351.43, 'EUR', 1000, 'EUR',
    'N 2026126000711287 BANKINTER CONSUMER FINANCE'],
  // Miles de verdad · no puede volverse 1,234.
  ['', '15/03/2026', '15/03/2026', 'Transferencia recibida',
    'Enviado por banco santander', 1234, 'EUR', 2234, 'EUR', 'Enviado por Banco Santander'],
];

/** La hoja entera · con las filas de relleno que BBVA pone antes de la tabla. */
export function hojaBBVA(): unknown[][] {
  return [
    [], ['', '', '', 'Últimos movimientos'],
    ['', '', '', 'Fecha de generación del informe: 30/08/2026'], [],
    [...CABECERAS_BBVA],
    ...FILAS_BBVA.map((f) => [...f]),
  ];
}
