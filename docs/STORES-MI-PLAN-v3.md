# STORES-MI-PLAN-v3 · Documentación técnica

Documento técnico de los 4 stores de Mi Plan v3. Describe schema, índices, validaciones, API de servicio y casos de uso típicos.

---

## 1 · `escenarios` (singleton)

### Schema

```typescript
interface Hito {
  id: string;          // UUID
  fecha: string;       // YYYY-MM-DD
  tipo: 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida';
  impactoMensual: number;  // € positivo=más renta / negativo=menos
  descripcion: string;
}

interface Escenario {
  id: number;          // singleton · siempre id=1
  // Configuración libertad
  modoVivienda: 'alquiler' | 'propia';
  gastosVidaLibertadMensual: number;
  estrategia: 'hibrido' | 'conservador' | 'agresivo';
  hitos: Hito[];       // embebido
  // KPIs macro (preexistentes)
  rentaPasivaObjetivo?: number;
  patrimonioNetoObjetivo?: number;
  cajaMinima?: number;
  dtiMaximo?: number;
  ltvMaximo?: number;
  yieldMinimaCartera?: number;
  tasaAhorroMinima?: number;
  updatedAt: string;
}
```

### Índices

Ninguno — es un singleton con `keyPath: 'id'`.

### Migración

- **V5.4**: Renombrado de `objetivos_financieros` → `escenarios`.
- Preserva los 7 campos KPI del store anterior.
- Añade 4 campos nuevos: `modoVivienda`, `gastosVidaLibertadMensual`, `estrategia`, `hitos`.
- Si no existía registro previo, se crea el singleton con defaults razonables.
- El store `objetivos_financieros` es eliminado tras la migración.

### API — `escenariosService.ts`

| Función | Descripción |
|---|---|
| `getEscenarioActivo()` | Retorna el singleton (nunca undefined — garantiza defaults) |
| `saveEscenarioActivo(partial)` | Actualiza campos parciales del singleton |
| `resetEscenario()` | Restaura los defaults |
| `addHito(hitoInput)` | Añade un hito al array embebido, genera UUID |
| `updateHito(hitoId, patch)` | Actualiza un hito por id |
| `removeHito(hitoId)` | Elimina un hito del array |
| `listHitos()` | Retorna todos los hitos del singleton |

### Caso Jose

```typescript
// Configuración de escenario libertad de Jose
await saveEscenarioActivo({
  modoVivienda: 'propia',          // tiene piso en propiedad
  gastosVidaLibertadMensual: 3500, // estimación gastos en libertad
  estrategia: 'agresivo',          // compra cada 18 meses aprox
  rentaPasivaObjetivo: 5000,       // 5.000 €/mes CF objetivo
  patrimonionetoObjetivo: 1200000,
  dtiMaximo: 40,
});

// Hito planificado: compra 6º piso en 2027
await addHito({
  fecha: '2027-03-01',
  tipo: 'compra',
  impactoMensual: 850,
  descripcion: 'Compra 6º inmueble · Sant Cugat 80m²',
});
```

---

## 2 · `objetivos` (lista)

### Schema

```typescript
type ObjetivoEstado = 'en-progreso' | 'en-riesgo' | 'en-pausa' | 'completado' | 'archivado';

type Objetivo = ObjetivoBase & (
  | { tipo: 'acumular'; metaCantidad: number; fondoId: string }
  | { tipo: 'amortizar'; metaCantidad: number; prestamoId: string }
  | { tipo: 'comprar'; metaCantidad: number; fondoId: string; capacidadEndeudamientoEsperada?: number }
  | { tipo: 'reducir'; metaCantidadMensual: number; categoriaGasto: string }
);
```

### Índices

| Índice | Campo | Unique |
|---|---|---|
| `tipo` | `tipo` | No |
| `estado` | `estado` | No |
| `fondoId` | `fondoId` | No |
| `prestamoId` | `prestamoId` | No |

### Validaciones

- `fechaCierre` debe ser fecha futura (YYYY-MM-DD) al crear.
- `metaCantidad` / `metaCantidadMensual` deben ser > 0.
- `tipo='acumular'` y `tipo='comprar'`: `fondoId` es obligatorio y debe existir en `fondos_ahorro`.
- `tipo='amortizar'`: `prestamoId` es obligatorio y debe existir en `prestamos`.
- `tipo='reducir'`: `categoriaGasto` es obligatorio.
- Solo se puede eliminar un objetivo si está en estado `'archivado'`.

### API — `objetivosService.ts`

| Función | Descripción |
|---|---|
| `createObjetivo(input)` | Crea objetivo (valida FKs y fechaCierre) |
| `getObjetivo(id)` | Lectura por UUID |
| `listObjetivos(filters?)` | Lista con filtros opcionales de estado/tipo |
| `updateObjetivo(id, patch)` | Update parcial · bumps updatedAt |
| `archiveObjetivo(id)` | Pone estado='archivado' (soft-delete) |
| `deleteObjetivo(id)` | Borrado físico · solo si estado='archivado' |
| `getObjetivosByFondo(fondoId)` | Lookup por FK de fondo |
| `getObjetivosByPrestamo(prestamoId)` | Lookup por FK de préstamo |

### Caso Jose (4 objetivos)

```typescript
// Obj 1 — acumular entrada piso Sant Cugat
const obj1 = await createObjetivo({
  tipo: 'acumular',
  nombre: 'Entrada Sant Cugat',
  fechaCierre: '2027-03-01',
  estado: 'en-progreso',
  metaCantidad: 80000,
  fondoId: fondoCompra.id,
});

// Obj 2 — amortizar hipoteca piso 1
const obj2 = await createObjetivo({
  tipo: 'amortizar',
  nombre: 'Amortizar H1',
  fechaCierre: '2030-12-31',
  estado: 'en-progreso',
  metaCantidad: 40000,
  prestamoId: hipoteca1.id,
});

// Obj 3 — comprar con financiación bancaria
const obj3 = await createObjetivo({
  tipo: 'comprar',
  nombre: 'Piso Sant Cugat 80m²',
  fechaCierre: '2027-03-01',
  estado: 'en-progreso',
  metaCantidad: 80000,
  fondoId: fondoCompra.id,
  capacidadEndeudamientoEsperada: 200000,
});

// Obj 4 — reducir gasto restaurantes
const obj4 = await createObjetivo({
  tipo: 'reducir',
  nombre: 'Reducir restaurantes',
  fechaCierre: '2026-12-31',
  estado: 'en-progreso',
  metaCantidadMensual: 150,
  categoriaGasto: 'restaurantes',
});
```

---

## 3 · `fondos_ahorro` (lista)

### Schema

```typescript
type FondoTipo = 'colchon' | 'compra' | 'reforma' | 'impuestos' | 'capricho' | 'custom';

type CuentaAsignada =
  | { cuentaId: number; modo: 'completo' }
  | { cuentaId: number; modo: 'parcial'; modoImporte: 'fijo'; importeAsignado: number }
  | { cuentaId: number; modo: 'parcial'; modoImporte: 'porcentaje'; porcentajeAsignado: number };

interface FondoAhorro {
  id: string;           // UUID
  tipo: FondoTipo;
  nombre: string;
  descripcion?: string;
  cuentasAsignadas: CuentaAsignada[];
  metaImporte?: number;
  metaMeses?: number;   // solo tipo='colchon'
  activo: boolean;      // soft-delete
  createdAt: string;
  updatedAt: string;
}
```

### Índices

| Índice | Campo | Unique |
|---|---|---|
| `tipo` | `tipo` | No |
| `activo` | `activo` | No |

### Validaciones

- Una cuenta NO puede estar asignada en modo `'completo'` a más de 1 fondo activo.
- La suma de `porcentajeAsignado` sobre la misma cuenta NO puede superar 100%.
- Ambas validaciones se comprueban en `createFondo` y `updateFondo`.

### API — `fondosService.ts`

| Función | Descripción |
|---|---|
| `createFondo(input)` | Crea fondo · valida solapamiento de cuentas |
| `getFondo(id)` | Lectura por UUID |
| `listFondos(filters?)` | Lista con filtros opcionales de tipo/activo |
| `updateFondo(id, patch)` | Update parcial · revalida solapamiento |
| `archiveFondo(id)` | Pone activo=false (soft-delete) |
| `reactivateFondo(id)` | Pone activo=true |
| `getSaldoActualFondo(fondoId)` | Calcula saldo real según modo de asignación |
| `getDistribucionFondos()` | Distribución completa + sinProposito |

#### `getSaldoActualFondo` — modos de cálculo

- **`modo='completo'`**: saldo total de la cuenta.
- **`modo='parcial' + modoImporte='fijo'`**: `importeAsignado`.
- **`modo='parcial' + modoImporte='porcentaje'`**: `(porcentajeAsignado / 100) * saldoCuenta`.

### Caso Jose (4 fondos)

```typescript
// Fondo 1 — colchón (cuenta dedicada)
const fondoColchon = await createFondo({
  tipo: 'colchon',
  nombre: 'Colchón 6 meses',
  cuentasAsignadas: [{ cuentaId: 3, modo: 'completo' }],
  metaMeses: 6,
});

// Fondo 2 — entrada piso (importe fijo sobre cuenta principal)
const fondoCompra = await createFondo({
  tipo: 'compra',
  nombre: 'Entrada Sant Cugat',
  cuentasAsignadas: [{ cuentaId: 1, modo: 'parcial', modoImporte: 'fijo', importeAsignado: 80000 }],
  metaImporte: 80000,
});

// Fondo 3 — reforma (30% de cuenta de reservas)
const fondoReforma = await createFondo({
  tipo: 'reforma',
  nombre: 'Reforma vivienda actual',
  cuentasAsignadas: [{ cuentaId: 2, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 30 }],
});

// Fondo 4 — impuestos (20% de cuenta de reservas)
const fondoImpuestos = await createFondo({
  tipo: 'impuestos',
  nombre: 'Reserva IRPF',
  cuentasAsignadas: [{ cuentaId: 2, modo: 'parcial', modoImporte: 'porcentaje', porcentajeAsignado: 20 }],
});
```

---

## 4 · `retos` (lista con constraint UNIQUE por mes)

### Schema

```typescript
type RetoTipo = 'ahorro' | 'ejecucion' | 'disciplina' | 'revision';
type RetoEstado = 'futuro' | 'activo' | 'completado' | 'parcial' | 'fallado';

interface Reto {
  id: string;           // UUID
  tipo: RetoTipo;
  mes: string;          // YYYY-MM · UNIQUE en índice
  titulo: string;
  descripcion?: string;
  metaCantidad?: number;    // para tipo 'ahorro' y 'ejecucion'
  metaBinaria?: boolean;    // para tipo 'revision'
  estado: RetoEstado;
  vinculadoA?: {
    objetivoId?: string;
    fondoId?: string;
    prestamoId?: string;
    categoriaGasto?: string;
  };
  origenSugerencia?: 'atlas' | 'usuario';  // V1 siempre 'usuario'
  notasCierre?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Índices

| Índice | Campo | Unique |
|---|---|---|
| `mes` | `mes` | **Sí** — fuerza 1 reto por mes |
| `estado` | `estado` | No |
| `tipo` | `tipo` | No |

⚠ El índice `mes` es UNIQUE. Si se intenta crear un 2º reto para el mismo mes, IndexedDB lanza `ConstraintError`. El servicio captura este error y retorna un mensaje útil al usuario.

### Validaciones

- `mes` debe ser formato `YYYY-MM` exacto.
- Solo puede haber 1 reto con `estado='activo'` a la vez.
- `tipo='ahorro'` o `tipo='ejecucion'`: `metaCantidad` es obligatorio.
- `tipo='revision'`: `metaBinaria` es obligatorio (siempre `true` al crear).
- `origenSugerencia` por defecto es `'usuario'` (V1).

### API — `retosService.ts`

| Función | Descripción |
|---|---|
| `createReto(input)` | Crea reto · valida mes UNIQUE y solo-un-activo |
| `getReto(id)` | Lectura por UUID |
| `getRetoByMes(mes)` | Lookup por mes (vía índice UNIQUE) |
| `listRetos(filters?)` | Lista con filtros opcionales |
| `updateReto(id, patch)` | Update parcial |
| `deleteReto(id)` | Borrado físico |
| `getRetoActivo()` | Retorna el reto con estado='activo' |
| `getRetosUltimos12Meses()` | Historial de los últimos 12 meses (ordenado) |
| `cerrarReto(id, resultado, notas?)` | Cierra el reto con resultado y notas opcionales |

### Caso Jose (1 reto)

```typescript
// Reto activo para abril 2026
const retoAbril = await createReto({
  tipo: 'ahorro',
  mes: '2026-04',
  titulo: 'Ahorrar 1.500€ extra para entrada Sant Cugat',
  metaCantidad: 1500,
  estado: 'activo',
  vinculadoA: { objetivoId: obj1.id, fondoId: fondoCompra.id },
});

// Al final del mes: cierre con resultado
await cerrarReto(retoAbril.id, 'completado', 'Conseguí 1.650€, superé la meta');

// Ver historial
const historial = await getRetosUltimos12Meses();
```

---

## 5 · Diagrama de relaciones

```
Objetivo (acumular/comprar)  ─── fondoId ──► FondoAhorro
                                               └── cuentasAsignadas ──► accounts
Objetivo (amortizar)  ─────── prestamoId ──► prestamos

Reto  ─── vinculadoA.objetivoId ──► Objetivo
      ─── vinculadoA.fondoId    ──► FondoAhorro
      ─── vinculadoA.prestamoId ──► prestamos

Escenario (singleton)  ── (no FK externos) ── datos de configuración libertad
                        └── hitos[] (embebido)
```

---

## 6 · Versiones de DB

| Versión | Store | Operación |
|---|---|---|
| V5.4 | `escenarios` | CREATE (migrado de `objetivos_financieros` eliminado) |
| V5.5 | `objetivos` | CREATE con 4 índices |
| V5.6 | `fondos_ahorro` | CREATE con 2 índices |
| V5.7 | `retos` | CREATE con 3 índices (mes UNIQUE) |
