# Tarea 2.2 — Servicio de Snapshots de Declaración (Guía para Codex)

## Objetivo
Implementar un servicio de dominio que **congele** la declaración IRPF anual en `snapshotsDeclaracion`, incluyendo:

- Datos estructurados de la declaración.
- Arrastres aplicados/generados del ejercicio.
- Hash de integridad para detectar cambios.
- Reglas de idempotencia para no duplicar snapshots de cierre.

---

## Estado actual en el código (base ya existente)

### 1) Schema persistente disponible
Ya existe el tipo `SnapshotDeclaracion` y su store `snapshotsDeclaracion` en IndexedDB.

Campos actuales:

- `ejercicio`
- `fechaSnapshot`
- `datos`:
  - `baseGeneral`
  - `baseAhorro`
  - `reducciones`
  - `minimosPersonales`
  - `liquidacion`
  - `arrastresGenerados: number[]`
  - `arrastresAplicados: number[]`
- `casillasAEAT?`
- `origen: 'cierre_automatico' | 'importacion_manual'`
- `hash?`
- `createdAt`

Índices ya definidos:

- `ejercicio`
- `fechaSnapshot`
- `origen`

### 2) Productor de datos fiscales
`calcularDeclaracionIRPF(ejercicio, opciones?)` devuelve `DeclaracionIRPF` con:

- `baseGeneral`
- `baseAhorro`
- `reducciones`
- `minimoPersonal`
- `liquidacion`
- `retenciones`
- `resultado`
- `tipoEfectivo`
- `conciliacion?`

### 3) Arrastres disponibles
Existe store `arrastresIRPF` con datos por inmueble / categoría y metadatos de expiración.

---

## Alcance recomendado para Tarea 2.2

Crear `src/services/snapshotDeclaracionService.ts` con API pública:

```ts
export interface CrearSnapshotOpts {
  origen?: 'cierre_automatico' | 'importacion_manual';
  incluirCasillasAEAT?: boolean;
  force?: boolean; // salta idempotencia si true
}

export async function crearSnapshotDeclaracion(
  ejercicio: number,
  opts?: CrearSnapshotOpts
): Promise<SnapshotDeclaracion>

export async function obtenerSnapshotDeclaracion(
  ejercicio: number
): Promise<SnapshotDeclaracion | null>

export async function listarSnapshotsDeclaracion(): Promise<SnapshotDeclaracion[]>

export async function verificarIntegridadSnapshot(
  idSnapshot: number
): Promise<{ ok: boolean; hashActual: string; hashGuardado?: string }>
```

---

## Reglas funcionales

1. **Construcción de datos base**
   - Invocar `calcularDeclaracionIRPF(ejercicio, { usarConciliacion: true })`.
   - Mapear `minimoPersonal` -> `datos.minimosPersonales` (manteniendo compatibilidad con schema actual).

2. **Extracción de arrastres**
   - Consultar `arrastresIRPF` por `ejercicio`.
   - Guardar en snapshot arrays de IDs (`arrastresGenerados`, `arrastresAplicados`) para trazabilidad mínima.

3. **Hash de integridad**
   - Canonicalizar payload (orden estable de keys) y calcular `SHA-256`.
   - Persistir en `hash`.

4. **Idempotencia**
   - Si ya existe snapshot `origen='cierre_automatico'` del ejercicio y `force !== true`, devolver el existente.

5. **Orden de lectura**
   - `obtenerSnapshotDeclaracion(ejercicio)` debe devolver el más reciente por `fechaSnapshot`.

6. **Compatibilidad hacia atrás**
   - No modificar el contrato del `SnapshotDeclaracion` en DB para no romper import/export.

---

## Criterios de aceptación sugeridos

1. Crea snapshot válido con `datos` completos desde `DeclaracionIRPF`.
2. Guarda `hash` no vacío y `verificarIntegridadSnapshot()` devuelve `ok=true` justo tras crear.
3. Repetir creación con mismo ejercicio y `origen='cierre_automatico'` devuelve el mismo registro (idempotencia).
4. `force=true` crea un nuevo snapshot.
5. `obtenerSnapshotDeclaracion()` retorna el último snapshot del ejercicio.

---

## Plan mínimo de tests (unit/integration sobre IndexedDB fake)

Archivo propuesto: `src/services/__tests__/snapshotDeclaracionService.test.ts`

Casos:

1. **create snapshot**: persiste estructura completa.
2. **idempotencia**: segunda llamada sin `force` no duplica.
3. **force**: segunda llamada con `force` sí duplica.
4. **integridad**: hash coincide.
5. **listado**: orden descendente por fecha.

---

## Notas de implementación

- Reusar helpers existentes de `db.ts` y patrón de servicios asíncronos del repositorio.
- Para hash en browser, usar `crypto.subtle.digest`; en tests Node/JSDOM, fallback a `node:crypto` si fuese necesario.
- Evitar dependencias nuevas si no son imprescindibles.
