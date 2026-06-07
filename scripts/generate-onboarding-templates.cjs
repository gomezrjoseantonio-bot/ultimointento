/**
 * Generador de las plantillas Excel del onboarding día 0.
 * Replica el patrón de `plantilla-contratos-atlas.xlsx` (header + ejemplo).
 * Ejecutar: `node scripts/generate-onboarding-templates.cjs`
 * Salida: public/templates/plantilla-{inmuebles,prestamos,inversiones}-atlas.xlsx
 */
const path = require('path');
const XLSX = require('xlsx');

const OUT_DIR = path.join(__dirname, '..', 'public', 'templates');

function write(filename, aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atlas');
  XLSX.writeFile(wb, path.join(OUT_DIR, filename));
  console.log('· escrito', filename);
}

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
