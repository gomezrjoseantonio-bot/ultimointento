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
write('plantilla-prestamos-atlas.xlsx', [
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
    new Date(2021, 6, 1), // 01/07/2021
    'fijo',
  ],
]);

// ── Inversiones ─────────────────────────────────────────────────────────────
write('plantilla-inversiones-atlas.xlsx', [
  [
    'Tipo (fondo/accion/etf/crypto/plan_pensiones/deposito/otro)',
    'Entidad',
    'Producto',
    'Unidades',
    'Coste adquisición €',
    'Fecha compra',
    'Valor de hoy €',
  ],
  ['fondo', 'Indexa Capital', 'Indexa RV Mixta', 120, 10000, new Date(2022, 2, 10), 12500], // 10/03/2022
]);

console.log('Plantillas del onboarding generadas en', OUT_DIR);
