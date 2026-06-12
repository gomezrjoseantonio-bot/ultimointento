/**
 * Generador de las plantillas Excel del onboarding día 0.
 * Replica el patrón de `plantilla-contratos-atlas.xlsx` (header + ejemplo).
 * Ejecutar: `node scripts/generate-onboarding-templates.cjs`
 * Salida: public/templates/plantilla-{inmuebles,prestamos,inversiones}-atlas.xlsx
 *
 * Regla transversal es-ES (§2.7): las columnas de fecha se escriben como celda
 * de fecha REAL de Excel con formato dd/mm/aaaa (no texto ISO). Los importes
 * son numéricos (Excel los muestra 1.234,56 en configuración española). Los
 * parsers aceptan celda nativa, DD/MM/AAAA e ISO (retrocompatibilidad).
 */
const path = require('path');
const XLSX = require('xlsx');

const OUT_DIR = path.join(__dirname, '..', 'public', 'templates');

/**
 * Escribe un .xlsx. `aoa` = matriz (fila 0 = cabeceras). Las celdas con valor
 * `Date` se formatean dd/mm/aaaa. `notas` (opcional) = líneas de una hoja Léeme.
 * `sheetName` = nombre de la hoja de datos (la plantilla de contratos usa
 * "Contratos" por compatibilidad con la plantilla original).
 */
function write(filename, aoa, notas, sheetName = 'Atlas') {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  // Formato es-ES para toda celda de fecha (las que llevan Date en el aoa).
  for (let r = 1; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      if (aoa[r][c] instanceof Date) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) {
          ws[ref].t = 'd';
          ws[ref].z = 'dd/mm/yyyy';
        }
      }
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  if (notas && notas.length) {
    const wsNotas = XLSX.utils.aoa_to_sheet(notas.map((l) => [l]));
    XLSX.utils.book_append_sheet(wb, wsNotas, 'Léeme');
  }
  XLSX.writeFile(wb, path.join(OUT_DIR, filename));
  console.log('· escrito', filename);
}

// ── Contratos (FIX P4 · espejo del wizard) ───────────────────────────────────
// Las 11 columnas base (obligatorias/mínimas) NO cambian de nombre ni posición
// para mantener la retrocompatibilidad con plantillas ya rellenadas. Se AÑADEN
// 4 columnas OPCIONALES al final (Día de pago · Indexación · Reducción IRPF % ·
// Cotitulares) que reflejan el wizard de contrato. El parser las reconoce por
// nombre, así que una plantilla vieja de 11 columnas sigue funcionando. Fechas
// como celda Date real (es-ES dd/mm/aaaa · §2.7) · el parser acepta serial Excel.
write(
  'plantilla-contratos-atlas.xlsx',
  [
    [
      'Inmueble (nombre o ref. catastral)',
      'Habitación',
      'Tipo de contrato',
      'Fecha inicio',
      'Fecha fin',
      'Inquilino nombre completo',
      'DNI/NIF inquilino',
      'Email inquilino',
      'Teléfono inquilino',
      'Renta mensual €',
      'Fianza €',
      // ── Opcionales (espejo del wizard) ──
      'Día de pago',
      'Indexación',
      'Reducción IRPF %',
      'Cotitulares (NIFs)',
    ],
    [
      'CB Sant Fruitós', 'Hab 2', 'Vivienda LAU', new Date(2024, 0, 1), new Date(2028, 11, 31),
      'CONCEPCION RAMIREZ GUERERO', '53639208B', 'contacto@ejemplo.com', '+34 666 555 444', 330, 330,
      1, 'IPC anual', 60, '',
    ],
    [
      'RC 7949807TP6074N0006YM', '', 'Vivienda LAU', new Date(2024, 1, 1), '',
      'JORGE ANDERSON RIOS POSADA', '', 'jorge@ejemplo.com', '+34 600 111 222', 600, 600,
      5, 'Sin indexación', 50, '12345678Z',
    ],
    [
      'Piso Centro Madrid', '', 'Vacacional', new Date(2024, 6, 1), new Date(2024, 7, 31),
      'FAMILIA MARTINEZ', '', '', '', 1200, 0,
      1, '', 0, '',
    ],
  ],
  undefined,
  'Contratos',
);

// ── Inmuebles ───────────────────────────────────────────────────────────────
// Espejo del formulario de inmueble. Obligatorias SOLO: alias o dirección + tipo.
write(
  'plantilla-inmuebles-atlas.xlsx',
  [
    [
      'Alias',
      'Dirección',
      'Tipo de inmueble (piso/parking/trastero/local/otro)',
      'Referencia catastral',
      'Uso y alquiler (larga_estancia/temporada/turistico/mixto/vivienda_habitual/disponible)',
      'Alquiler por habitaciones (sí/no)',
      'Nº habitaciones',
      'Baños',
      'm² útiles',
      'Urbana/rústica',
      '% propiedad',
      'Anexo parking (sí/no)',
      'Anexo trastero (sí/no)',
      'Fecha compra',
      'Precio compra €',
      'Gastos compra €',
      'Aportación propia €',
      'Importe financiado €',
      'Valor catastral €',
      'Valor catastral construcción €',
      'Valor catastral revisado (sí/no)',
    ],
    [
      'Piso Centro',
      'Calle Mayor 10, Madrid',
      'piso',
      '1234567VK1234S0001AB',
      'larga_estancia',
      'no',
      3,
      2,
      90,
      'urbana',
      100,
      'sí',
      'no',
      new Date(2021, 5, 15), // 15/06/2021
      100000,
      12000,
      32000,
      80000,
      60000,
      42000,
      'sí',
    ],
  ],
  [
    'PLANTILLA DE INMUEBLES · Atlas',
    '',
    'Obligatorias: Alias o Dirección, y Tipo de inmueble. El resto es opcional;',
    'lo que dejes vacío lo podrás completar luego en la ficha del inmueble.',
    '',
    'NO se incluyen aquí (se editan en la ficha del inmueble, son listas):',
    ' · Mejoras / reformas previas',
    ' · Mobiliario',
    '',
    'Fechas en formato DD/MM/AAAA. Importes con coma decimal (1.234,56).',
  ],
);

// ── Préstamos ───────────────────────────────────────────────────────────────
// FIX PUNTO 5 (P1) · ESPEJO del modal Nuevo préstamo · columnas 1-10 = base
// (obligatorias: Nombre y Principal inicial) · 11-24 OPCIONALES (tipo, demora,
// comisiones, carencia, destino del capital -deducibilidad-, garantía).
// Retrocompatible: una plantilla con solo las 10 primeras sigue siendo válida.
write(
  'plantilla-prestamos-atlas.xlsx',
  [
    [
      'Nombre',
      'Inmueble vinculado (alias o RC)',
      'Cuenta de cargo (IBAN o alias)',
      'Principal inicial €',
      'Principal vivo €',
      'TIN %',
      'Plazo total (meses)',
      'Día de cargo',
      'Fecha primer cargo',
      'Tipo (fijo/variable/mixto)',
      'Tipo de préstamo (hipotecario/personal/linea_credito/otro)',
      'Interés de demora %',
      'Comisión apertura %',
      'Comisión mantenimiento €',
      'Comisión amortización anticipada %',
      'Comisión modificación condiciones %',
      'Comisión cancelación total %',
      'Carencia (ninguna/solo_capital/total)',
      'Carencia meses',
      'Destino del capital (adquisicion/reforma/cancelar_deuda/inversion/personal/otra)',
      'Destino importe €',
      'Destino %',
      'Garantía (hipotecaria/personal/pignoraticia)',
      'Garantía sobre (inmueble alias/RC · informativa)',
    ],
    [
      'Hipoteca Piso Centro',
      'Piso Centro',
      'ES7620770024003102575766',
      80000,
      72000,
      2.5,
      300,
      1,
      new Date(2021, 6, 1), // 01/07/2021 · se escribe DD/MM/AAAA
      'fijo',
      'hipotecario',
      12,
      0.5,
      0,
      0.5,
      0,
      0.5,
      'ninguna',
      0,
      'adquisicion',
      80000,
      100,
      'hipotecaria',
      'Piso Centro',
    ],
  ],
  [
    'Plantilla de préstamos · Atlas',
    '',
    'OBLIGATORIAS · solo "Nombre" y "Principal inicial €". El resto es opcional.',
    'FECHAS · formato DD/MM/AAAA. IMPORTES · coma decimal (1.234,56).',
    '',
    'DESTINO DEL CAPITAL · para qué se pidió el dinero (determina la deducibilidad).',
    '  · adquisicion/reforma + inmueble vinculado → intereses deducibles en ese inmueble.',
    '  · una fila admite UN destino. Si un préstamo financia varios inmuebles, créalo',
    '    aquí con su destino principal y añade el resto en la ficha del préstamo.',
    '',
    'GARANTÍA · qué responde si no pagas (informativa · NO afecta a la fiscalidad).',
    '',
    'COMPATIBILIDAD · la plantilla anterior de 10 columnas sigue funcionando.',
  ],
);

// ── Inversiones (FIX PUNTO 7 · espejo de las 6 familias del modal) ────────────
// Obligatorias SOLO: Tipo y Producto. El parser resuelve columnas POR NOMBRE,
// así que una plantilla vieja de 7 columnas (sin Subtipo/ISIN/% atribución/TAE/
// Plazo) sigue funcionando. Fechas como celda Date real (es-ES dd/mm/aaaa).
write(
  'plantilla-inversiones-atlas.xlsx',
  [
    [
      'Tipo (plan_pensiones/fondo/accion_etf_reit/prestamo_activo/deposito_cuenta/crypto)',
      'Subtipo (PPE·PPI · accion·ETF·REIT · P2P·empresa · plazo·cuenta)',
      'Entidad',
      'Producto',
      'ISIN o ticker',
      'Unidades / participaciones',
      'Coste adquisición €',
      'Fecha compra',
      'Valor de hoy €',
      '% atribución (participaciones)',
      'TAE/TIN %',
      'Plazo (meses)',
    ],
    // Una fila de ejemplo por familia.
    ['plan_pensiones', 'PPE', 'VidaCaixa', 'PPE Empresa', '', '', 8000, new Date(2020, 0, 15), 9200, '', '', ''], // 15/01/2020
    ['fondo', 'FI', 'Indexa Capital', 'Indexa RV Mixta', 'IE00B4L5Y983', 120, 10000, new Date(2022, 2, 10), 12500, '', '', ''], // 10/03/2022
    ['accion_etf_reit', 'ETF', 'DEGIRO', 'iShares Core S&P 500', 'IE00B5BMR087', 50, 18000, new Date(2021, 8, 1), 24500, '', '', ''], // 01/09/2021
    ['accion_etf_reit', 'accion', 'CB Hermanos', 'Participación CB', '', 1, 30000, new Date(2019, 5, 1), 35000, 33.34, '', ''], // 01/06/2019
    ['prestamo_activo', 'P2P', 'Mintos', 'Préstamo SmartFlip', '', '', 5000, new Date(2023, 0, 10), 5000, '', 10, 24], // 10/01/2023
    ['deposito_cuenta', 'plazo', 'EBN Banco', 'Depósito 12 meses', '', '', 20000, new Date(2024, 2, 1), 20000, '', 3.2, 12], // 01/03/2024
    ['crypto', '', 'Kraken', 'Bitcoin', '', 0.5, 15000, new Date(2021, 10, 5), 22000, '', '', ''], // 05/11/2021
  ],
  [
    'PLANTILLA DE INVERSIONES · Atlas',
    '',
    'Obligatorias: Tipo y Producto. El resto es opcional; lo que dejes vacío',
    'lo podrás completar luego en la ficha de la posición.',
    '',
    'Tipo (familia): plan_pensiones · fondo · accion_etf_reit · prestamo_activo ·',
    'deposito_cuenta · crypto. El Subtipo afina la clase (PPE, ETF, REIT, P2P,',
    'cuenta, plazo…).',
    '',
    'Préstamo_activo = dinero que TE DEBEN (P2P o a empresa) · NO es tu hipoteca',
    '(esa va en el bloque Préstamos).',
    '',
    'Fechas en formato DD/MM/AAAA. Importes con coma decimal (1.234,56).',
  ],
);

console.log('Plantillas del onboarding generadas en', OUT_DIR);
