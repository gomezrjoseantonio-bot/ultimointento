/**
 * Generador de las plantillas Excel del onboarding día 0.
 * Replica el patrón de `plantilla-contratos-atlas.xlsx` (header + ejemplo).
 * Ejecutar: `node scripts/generate-onboarding-templates.cjs`
 * Salida: public/templates/plantilla-{inmuebles,prestamos,inversiones}-atlas.xlsx
 */
const path = require('path');
const XLSX = require('xlsx');

const OUT_DIR = path.join(__dirname, '..', 'public', 'templates');

function write(filename, aoa, sheetName = 'Atlas') {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(OUT_DIR, filename));
  console.log('· escrito', filename);
}

// ── Contratos (FIX P4 · espejo del wizard) ───────────────────────────────────
// Las 11 columnas base (obligatorias/mínimas) NO cambian de nombre ni posición
// para mantener la retrocompatibilidad con plantillas ya rellenadas. Se AÑADEN
// 4 columnas OPCIONALES al final (Día de pago · Indexación · Reducción IRPF % ·
// Cotitulares) que reflejan el wizard de contrato. El parser las reconoce por
// nombre, así que una plantilla vieja de 11 columnas sigue funcionando.
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
      'CB Sant Fruitós', 'Hab 2', 'Vivienda LAU', '01/01/2024', '31/12/2028',
      'CONCEPCION RAMIREZ GUERERO', '53639208B', 'contacto@ejemplo.com', '+34 666 555 444', 330, 330,
      1, 'IPC anual', 60, '',
    ],
    [
      'RC 7949807TP6074N0006YM', '', 'Vivienda LAU', '01/02/2024', '',
      'JORGE ANDERSON RIOS POSADA', '', 'jorge@ejemplo.com', '+34 600 111 222', 600, 600,
      5, 'Sin indexación', 50, '12345678Z',
    ],
    [
      'Piso Centro Madrid', '', 'Vacacional', '01/07/2024', '31/08/2024',
      'FAMILIA MARTINEZ', '', '', '', 1200, 0,
      1, '', 0, '',
    ],
  ],
  'Contratos',
);

// ── Inmuebles (C4) ──────────────────────────────────────────────────────────
write('plantilla-inmuebles-atlas.xlsx', [
  [
    'Alias',
    'Dirección',
    'Referencia catastral',
    'Modo explotación (completo/habitaciones)',
    'Nº habitaciones',
    'Fecha compra',
    'Precio compra €',
    'Gastos compra €',
    'Aportación propia €',
    'Importe financiado €',
    'Valor catastral €',
    'Valor catastral construcción €',
  ],
  [
    'Piso Centro',
    'Calle Mayor 10, Madrid',
    '1234567VK1234S0001AB',
    'completo',
    '',
    '2021-06-15',
    100000,
    12000,
    32000,
    80000,
    60000,
    42000,
  ],
]);

// ── Préstamos (C6) ──────────────────────────────────────────────────────────
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
    '2021-07-01',
    'fijo',
  ],
]);

// ── Inversiones (C6) ────────────────────────────────────────────────────────
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
  ['fondo', 'Indexa Capital', 'Indexa RV Mixta', 120, 10000, '2022-03-10', 12500],
]);

console.log('Plantillas del onboarding generadas en', OUT_DIR);
